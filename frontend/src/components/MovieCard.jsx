function MovieCard({ movie, city, isFavorite, onFavorite, onDetails, onBook }) {
  const showtimes = movie.showtimes.filter((showtime) => showtime.city === city);
  const firstShow = showtimes[0];

  return (
    <article className="movie-card">
      <button
        className="poster-art"
        style={{ '--poster-accent': movie.accent }}
        onClick={onDetails}
        aria-label={`View details for ${movie.title}`}
      >
        <span className="poster-stamp">CINEBOOK ORIGINALS</span>
        <span className="poster-title">{movie.title}</span>
        <span className="poster-bottom">{movie.genre.split(' · ').join('  /  ')}</span>
        <span className="poster-rating">★ {movie.rating.toFixed(1)}</span>
      </button>
      <div className="movie-card-body">
        <div className="movie-card-title-row">
          <div>
            <p className="movie-genre">{movie.genre}</p>
            <h3>{movie.title}</h3>
          </div>
          <button
            className={isFavorite ? 'favorite-button is-favorite' : 'favorite-button'}
            type="button"
            onClick={onFavorite}
            aria-label={isFavorite ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '♥' : '♡'}
          </button>
        </div>
        <div className="movie-facts">
          <span>{movie.language}</span><i /> <span>{movie.duration}</span><i /> <span>{movie.certificate}</span>
        </div>
        <div className="card-actions">
          <button className="button button-outline" onClick={onDetails}>Details</button>
          {firstShow ? (
            <button className="button button-primary" onClick={() => onBook(firstShow)}>
              Book tickets
            </button>
          ) : (
            <button className="button button-disabled" disabled>No shows</button>
          )}
        </div>
        {showtimes.length > 1 && (
          <p className="showtime-count">+ {showtimes.length - 1} more show{showtimes.length > 2 ? 's' : ''} in {city}</p>
        )}
      </div>
    </article>
  );
}

export default MovieCard;
