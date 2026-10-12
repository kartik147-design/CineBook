function HeroSection({ city, cities, query, onCityChange, onQueryChange, onBrowse }) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">The big screen is calling</p>
        <h1>Make tonight a <span>movie night.</span></h1>
        <p className="hero-description">
          Find the film. Pick your cinema. Choose your seats. Your perfect night out is only a few
          clicks away.
        </p>
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            onBrowse();
          }}
          role="search"
        >
          <span className="search-symbol" aria-hidden="true">⌕</span>
          <input
            aria-label="Search movies"
            placeholder="Search movies, genres, languages..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <button className="button button-primary" type="submit">Find a movie</button>
        </form>
        <div className="hero-proof">
          <span><i className="proof-dot" />Fresh picks</span>
          <span><i className="proof-dot" />Live seat availability</span>
          <span><i className="proof-dot" />Easy booking</span>
        </div>
      </div>

      <aside className="city-panel">
        <div className="city-panel-heading">
          <span className="city-icon">⌖</span>
          <div>
            <p className="section-kicker">Choose your city</p>
            <h2>What’s playing nearby?</h2>
          </div>
        </div>
        <div className="city-list">
          {cities.map((item) => (
            <button
              className={city === item ? 'city-chip selected' : 'city-chip'}
              key={item}
              onClick={() => onCityChange(item)}
              type="button"
            >
              {item}
              {city === item && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <div className="city-note">
          <span aria-hidden="true">✦</span>
          <p>Great stories are showing across {cities.length} cities.</p>
        </div>
      </aside>
    </section>
  );
}

export default HeroSection;
