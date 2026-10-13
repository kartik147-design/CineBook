import { useCallback, useEffect, useMemo, useState } from 'react';
import movies from './data/movies.json';
import AdminPanel from './components/AdminPanel.jsx';
import AuthModal from './components/AuthModal.jsx';
import BookingModal from './components/BookingModal.jsx';
import Header from './components/Header.jsx';
import HeroSection from './components/HeroSection.jsx';
import MovieCard from './components/MovieCard.jsx';
import MovieDetailsModal from './components/MovieDetailsModal.jsx';
import MyTickets from './components/MyTickets.jsx';
import PaymentPage from './components/PaymentPage.jsx';
import Recommendations from './components/Recommendations.jsx';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cinebook-session')) || null;
    } catch {
      return null;
    }
  });
  const [city, setCity] = useState('Delhi');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('All');
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cinebook-favorites')) || [];
    } catch {
      return [];
    }
  });
  const [recommendations, setRecommendations] = useState([]);
  const [authMode, setAuthMode] = useState(null);
  const [detailsMovie, setDetailsMovie] = useState(null);
  const [activeShowtime, setActiveShowtime] = useState(null);
  const [checkoutDraft, setCheckoutDraft] = useState(null);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminSummary, setAdminSummary] = useState(null);
  const [ticketVerification, setTicketVerification] = useState(null);
  const [view, setView] = useState('home');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingShowtime, setPendingShowtime] = useState(null);

  const cities = useMemo(
    () => [...new Set(movies.flatMap((movie) => movie.showtimes.map((show) => show.city)))],
    [],
  );
  const genres = useMemo(
    () => ['All', ...new Set(movies.map((movie) => movie.genre.split(' · ')[0]))],
    [],
  );
  const visibleMovies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return movies.filter((movie) => {
      const hasCityShow = movie.showtimes.some((show) => show.city === city);
      const matchesSearch =
        !normalizedQuery ||
        [movie.title, movie.genre, movie.language, ...movie.cast]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesGenre = genre === 'All' || movie.genre.split(' · ')[0] === genre;
      return hasCityShow && matchesSearch && matchesGenre;
    });
  }, [city, genre, query]);

  const refreshBookings = useCallback(async () => {
    if (!session?.token || session.user.role !== 'customer') {
      setTickets([]);
      setNotifications([]);
      return;
    }
    const result = await request('/bookings', { token: session.token });
    setTickets(result.bookings);
    try {
      const notificationResult = await request('/notifications', { token: session.token });
      setNotifications(notificationResult.notifications);
    } catch (error) {
      setNotice(error.message);
    }
  }, [session]);

  const refreshAdmin = useCallback(async () => {
    if (session?.user.role !== 'admin') return;
    setAdminSummary(await request('/admin/summary', { token: session.token }));
  }, [session]);

  useEffect(() => {
    if (!session) {
      localStorage.removeItem('cinebook-session');
      return undefined;
    }
    localStorage.setItem('cinebook-session', JSON.stringify(session));
    let cancelled = false;
    const endpoint = session.user.role === 'admin' ? '/admin/summary' : '/bookings';
    const accountRequest = request(endpoint, { token: session.token });
    accountRequest
      .then((result) => {
        if (cancelled) return;
        if (session.user.role === 'admin') setAdminSummary(result);
        else setTickets(result.bookings);
      })
      .catch((error) => {
        if (!cancelled) {
          if (error.status === 401) {
            setSession(null);
            setTickets([]);
            setNotifications([]);
            setAdminSummary(null);
            setActiveShowtime(null);
            setCheckoutDraft(null);
          }
          setNotice(error.message);
        }
      });
    if (session.user.role === 'customer') {
      request('/notifications', { token: session.token })
        .then((result) => {
          if (!cancelled) setNotifications(result.notifications);
        })
        .catch((error) => {
          if (!cancelled) setNotice(error.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    localStorage.setItem('cinebook-favorites', JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!activeShowtime) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await request(`/availability/${encodeURIComponent(activeShowtime.id)}`);
        if (!cancelled) setBookedSeats(result.bookedSeats);
      } catch (error) {
        if (!cancelled) setNotice(error.message);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeShowtime]);

  useEffect(() => {
    let cancelled = false;
    const watchedIds = [...new Set(tickets.map((ticket) => ticket.movieId))];
    request('/recommendations', {
      method: 'POST',
      body: JSON.stringify({ city, favoriteIds, watchedIds }),
    })
      .then((result) => {
        if (!cancelled) setRecommendations(result.recommendations);
      })
      .catch((error) => console.error('Could not load local movie recommendations:', error));
    return () => {
      cancelled = true;
    };
  }, [city, favoriteIds, tickets]);

  const startBooking = (movie, showtime) => {
    if (!session) {
      setPendingShowtime({ movie, showtime });
      setAuthMode('login');
      setNotice('Log in or create an account to choose seats.');
      return;
    }
    if (session.user.role !== 'customer') {
      setNotice('Admin accounts cannot make customer bookings.');
      return;
    }
    setBookedSeats([]);
    setCheckoutDraft(null);
    setActiveShowtime({ movie, ...showtime });
  };

  const handleAuth = async (mode, form) => {
    setBusy(true);
    try {
      const result = await request(mode === 'admin' ? '/auth/admin' : `/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setTickets([]);
      setNotifications([]);
      setAdminSummary(null);
      setSession({ token: result.token, user: result.user });
      setAuthMode(null);
      setNotice(mode === 'signup' ? 'Your CineBook account is ready.' : 'You are signed in.');
      if (mode !== 'admin' && pendingShowtime) {
        setActiveShowtime({ movie: pendingShowtime.movie, ...pendingShowtime.showtime });
        setPendingShowtime(null);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmBooking = async (paymentMethod, paymentDetails) => {
    if (!session || !activeShowtime || !checkoutDraft) {
      setNotice('Your seat selection expired. Please choose your seats again.');
      setCheckoutDraft(null);
      return;
    }
    setBusy(true);
    try {
      const result = await request('/bookings', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          showtimeId: activeShowtime.id,
          seats: checkoutDraft.seats,
          paymentMethod,
          paymentDetails,
        }),
      });
      setTickets((current) => [result.booking, ...current]);
      refreshBookings().catch((error) => setNotice(error.message));
      setBookedSeats((current) => [...current, ...result.booking.seats]);
      setCheckoutDraft(null);
      setActiveShowtime(null);
      setView('tickets');
      setNotice(
        paymentMethod === 'Pay at venue'
          ? 'Seats reserved. Your QR entry pass is ready; pay at the cinema counter.'
          : 'Demo payment successful. Your QR ticket is ready.',
      );
    } catch (error) {
      setNotice(error.message);
      try {
        const latest = await request(`/availability/${encodeURIComponent(activeShowtime.id)}`);
        setBookedSeats(latest.bookedSeats);
      } catch (refreshError) {
        setNotice(refreshError.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelTicket = async (ticketId) => {
    if (!session) return;
    try {
      await request(`/bookings/${encodeURIComponent(ticketId)}`, {
        method: 'DELETE',
        token: session.token,
      });
      await refreshBookings();
      setNotice('Ticket cancelled. Its seats are available for someone else.');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const verifyTicket = async (code) => {
    try {
      const queryCode = encodeURIComponent(code);
      setTicketVerification(await request(`/tickets/verify?code=${queryCode}`, { token: session?.token }));
    } catch (error) {
      setTicketVerification({ success: false, message: error.message });
    }
  };

  const toggleFavorite = (movieId) => {
    setFavoriteIds((current) =>
      current.includes(movieId)
        ? current.filter((id) => id !== movieId)
        : [...current, movieId],
    );
  };

  const logout = () => {
    if (session?.token) {
      request('/auth/logout', { method: 'POST', token: session.token }).catch((error) => {
        console.error('Could not invalidate the CineBook session:', error);
      });
    }
    setSession(null);
    setTickets([]);
    setNotifications([]);
    setAdminSummary(null);
    setActiveShowtime(null);
    setCheckoutDraft(null);
    setPendingShowtime(null);
    setView('home');
    setNotice('You have been logged out.');
  };

  const openTickets = () => {
    if (!session) {
      setAuthMode('login');
      setNotice('Sign in to view your tickets.');
      return;
    }
    setView('tickets');
  };

  const openRecommendedMovie = (movie) => {
    setCity(movie.showtimes.some((show) => show.city === city) ? city : movie.showtimes[0].city);
    setDetailsMovie(movie);
  };

  const renderMovies = () => (
    <>
      <HeroSection
        city={city}
        cities={cities}
        query={query}
        onCityChange={setCity}
        onQueryChange={setQuery}
        onBrowse={() => document.getElementById('movie-list')?.scrollIntoView({ behavior: 'smooth' })}
      />
      <Recommendations
        items={recommendations}
        movies={movies}
        onMovie={openRecommendedMovie}
      />
      <section className="catalog-section" id="movie-list">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">Curated for your next night out</p>
            <h2>Now showing in {city}</h2>
          </div>
          <label className="genre-select">
            <span>Genre</span>
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
              {genres.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {visibleMovies.length ? (
          <div className="movie-grid">
            {visibleMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                city={city}
                isFavorite={favoriteIds.includes(movie.id)}
                onFavorite={() => toggleFavorite(movie.id)}
                onDetails={() => setDetailsMovie(movie)}
                onBook={(showtime) => startBooking(movie, showtime)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">⌕</span>
            <h3>No movies found</h3>
            <p>Try another search, genre, or city.</p>
          </div>
        )}
      </section>
    </>
  );

  return (
    <div className="app-shell">
      <Header
        user={session?.user}
        currentView={view}
        onHome={() => {
          setView('home');
          setCheckoutDraft(null);
          setActiveShowtime(null);
        }}
        onTickets={openTickets}
        onAdmin={() => setView('admin')}
        onLogin={() => setAuthMode('login')}
        onSignup={() => setAuthMode('signup')}
        onAdminLogin={() => setAuthMode('admin')}
        onLogout={logout}
      />

      <main className="page-content">
        {view === 'home' && renderMovies()}
        {view === 'checkout' && activeShowtime && checkoutDraft && session && (
          <PaymentPage
            movie={activeShowtime.movie}
            showtime={activeShowtime}
            seats={checkoutDraft.seats}
            user={session.user}
            busy={busy}
            onBack={() => {
              setCheckoutDraft(null);
              setView('home');
            }}
            onSubmit={confirmBooking}
          />
        )}
        {view === 'tickets' && (
          <MyTickets tickets={tickets} notifications={notifications} onCancel={cancelTicket} />
        )}
        {view === 'admin' && (
          <AdminPanel
            isAdmin={session?.user.role === 'admin'}
            summary={adminSummary}
            verification={ticketVerification}
            onLogin={() => setAuthMode('admin')}
            onRefresh={() => refreshAdmin().catch((error) => setNotice(error.message))}
            onVerify={verifyTicket}
          />
        )}
      </main>

      <footer className="site-footer">
        <span>CineBook</span>
        <p>Movie nights, made memorable.</p>
        <small>Checkout is a demo. No real payment is processed.</small>
      </footer>

      {authMode && (
        <AuthModal
          mode={authMode}
          busy={busy}
          onClose={() => setAuthMode(null)}
          onSubmit={handleAuth}
          onModeChange={setAuthMode}
        />
      )}
      {detailsMovie && (
        <MovieDetailsModal
          movie={detailsMovie}
          city={city}
          onClose={() => setDetailsMovie(null)}
          onBook={(showtime) => {
            setDetailsMovie(null);
            startBooking(detailsMovie, showtime);
          }}
        />
      )}
      {activeShowtime && !checkoutDraft && (
        <BookingModal
          movie={activeShowtime.movie}
          showtime={activeShowtime}
          bookedSeats={bookedSeats}
          onClose={() => setActiveShowtime(null)}
          onCheckout={(seats) => {
            setCheckoutDraft({ seats });
            setView('checkout');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

export default App;
