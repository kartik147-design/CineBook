function MovieDetailsModal({ movie, city, onClose, onBook }) {
  const showtimes = movie.showtimes.filter((showtime) => showtime.city === city);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-details-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close details">×</button>
        <div className="details-art" style={{ '--poster-accent': movie.accent }}>
          <span className="poster-stamp">CINEBOOK ORIGINALS</span>
          <span className="details-art-title">{movie.title}</span>
          <span className="poster-bottom">{movie.genre}</span>
        </div>
        <div className="details-content">
          <p className="section-kicker">Movie spotlight</p>
          <h2 id="movie-details-title">{movie.title}</h2>
          <div className="details-facts">
            <span className="rating-pill">★ {movie.rating.toFixed(1)}</span>
            <span>{movie.duration}</span><span>{movie.language}</span><span>{movie.certificate}</span>
          </div>
          <p className="details-synopsis">{movie.synopsis}</p>
          <p className="cast-line"><strong>Starring</strong> {movie.cast.join(' · ')}</p>
          <div className="details-showtimes">
            <h3>Showtimes in {city}</h3>
            {showtimes.length ? showtimes.map((showtime) => (
              <div className="showtime-row" key={showtime.id}>
                <div>
                  <strong>{showtime.cinema}</strong>
                  <span>{showtime.screen} · {showtime.date} · {showtime.time}</span>
                </div>
                <button className="button button-primary" onClick={() => onBook(showtime)}>
                  ₹{showtime.price} · Select
                </button>
              </div>
            )) : <p>No screenings listed for this city yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default MovieDetailsModal;
