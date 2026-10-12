function Recommendations({ items, movies, onMovie }) {
  if (!items.length) return null;
  const byId = new Map(movies.map((movie) => [movie.id, movie]));
  const recommendations = items.map((item) => ({ ...item, movie: byId.get(item.id) })).filter((item) => item.movie);

  return (
    <section className="recommendations-section">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">Picked for your next watch</p>
          <h2>A little something you might love</h2>
        </div>
        <span className="model-tag"><i /> CineBook matchmaker</span>
      </div>
      <div className="recommendations-grid">
        {recommendations.map(({ movie, reason }) => (
          <button className="recommendation-card" key={movie.id} onClick={() => onMovie(movie)}>
            <span className="recommendation-art" style={{ '--poster-accent': movie.accent }}>
              <strong>{movie.title}</strong>
              <small>★ {movie.rating.toFixed(1)}</small>
            </span>
            <span className="recommendation-info">
              <strong>{movie.title}</strong>
              <small>{reason}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default Recommendations;
