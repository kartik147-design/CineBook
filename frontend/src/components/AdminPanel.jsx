import { useState } from 'react';

function AdminPanel({ isAdmin, summary, verification, onLogin, onRefresh, onVerify }) {
  if (!isAdmin) {
    return (
      <section className="admin-gate">
        <div className="admin-gate-icon">✦</div>
        <p className="section-kicker">CineBook operations</p>
        <h1>Admin dashboard</h1>
        <p>Sign in with the operator credentials configured on the backend to see booking and sales summaries.</p>
        <button className="button button-primary" onClick={onLogin}>Admin sign in</button>
      </section>
    );
  }

  return (
    <section className="dashboard-section admin-dashboard">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">CineBook operations</p>
          <h1>Admin dashboard</h1>
        </div>
        <button className="button button-outline" onClick={onRefresh}>Refresh data</button>
      </div>
      {!summary ? (
        <div className="empty-state"><p>Loading dashboard data…</p></div>
      ) : (
        <>
          <div className="admin-metrics">
            <article><span>Active accounts</span><strong>{summary.users}</strong></article>
            <article><span>Total bookings</span><strong>{summary.bookings}</strong></article>
            <article><span>Confirmed demo sales</span><strong>₹{summary.demoSales}</strong></article>
            <article><span>Seats reserved</span><strong>{summary.seatsReserved}</strong></article>
          </div>
          <div className="admin-table-wrap">
            <h2>Recent bookings</h2>
            {summary.recentBookings.length ? (
              <div className="admin-table">
                <div className="admin-table-row admin-table-head">
                  <span>Movie</span><span>Show</span><span>Seats</span><span>Amount</span><span>State</span>
                </div>
                {summary.recentBookings.map((booking) => (
                  <div className="admin-table-row" key={booking.id}>
                    <span>{booking.movieTitle}</span>
                    <span>{booking.city} · {booking.time}</span>
                    <span>{booking.seats.join(', ')}</span>
                    <span>₹{booking.total}</span>
                    <span>{booking.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="admin-empty">No bookings have been made yet.</p>}
            <p className="demo-note">Demo checkout figures are not real payment revenue.</p>
          </div>
          <TicketVerifier result={verification} onVerify={onVerify} />
        </>
      )}
    </section>
  );
}

function TicketVerifier({ result, onVerify }) {
  const [code, setCode] = useState('');

  return (
    <section className="ticket-verifier">
      <div>
        <p className="section-kicker">Entry desk</p>
        <h2>Verify a ticket</h2>
        <p>Paste the text encoded in the ticket QR to check its signature and current status.</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onVerify(code.trim());
        }}
      >
        <input
          aria-label="Ticket QR payload"
          placeholder="CINEBOOK:ticket-id:signature"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
        <button className="button button-primary" type="submit">Verify pass</button>
      </form>
      {result && (
        <div className={result.success ? 'verification-result valid' : 'verification-result invalid'}>
          {result.success
            ? `${result.ticket.movieTitle} · ${result.ticket.date}, ${result.ticket.time} · ${result.ticket.seats.join(', ')} · ${result.ticket.status}`
            : result.message}
        </div>
      )}
    </section>
  );
}

export default AdminPanel;
