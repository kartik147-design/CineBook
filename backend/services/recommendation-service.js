const express = require('express');
const movies = require('../../frontend/src/data/movies.json');

const app = express();
const PORT = Number(process.env.RECOMMENDATION_SERVICE_PORT || 5105);
const stopWords = new Set(['the', 'and', 'of', 'to', 'in', 'a', 'part', 'with']);

app.use(express.json({ limit: '24kb' }));

function featuresFor(movie) {
  const tokens = [...movie.genre.split('·'), movie.language, ...movie.cast]
    .flatMap((part) => part.toLowerCase().split(/[^a-z0-9]+/))
    .filter((token) => token.length > 1 && !stopWords.has(token));
  return tokens.reduce((features, token) => {
    features[token] = (features[token] || 0) + 1;
    return features;
  }, {});
}

const documentFrequency = {};
const movieFeatures = new Map(movies.map((movie) => [movie.id, featuresFor(movie)]));
for (const features of movieFeatures.values()) {
  for (const term of new Set(Object.keys(features))) {
    documentFrequency[term] = (documentFrequency[term] || 0) + 1;
  }
}

function vectorFor(features) {
  return Object.fromEntries(
    Object.entries(features).map(([term, frequency]) => [
      term,
      (1 + Math.log(frequency)) *
        (1 + Math.log(movies.length / (1 + (documentFrequency[term] || 0)))),
    ]),
  );
}

function cosine(first, second) {
  const terms = new Set([...Object.keys(first), ...Object.keys(second)]);
  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;
  for (const term of terms) {
    dot += (first[term] || 0) * (second[term] || 0);
    firstNorm += (first[term] || 0) ** 2;
    secondNorm += (second[term] || 0) ** 2;
  }
  return firstNorm && secondNorm ? dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm)) : 0;
}

app.get('/health', (_req, res) => res.json({ status: 'healthy', service: 'recommendations' }));

app.post('/recommendations', (req, res) => {
  const city = typeof req.body?.city === 'string' ? req.body.city : '';
  const favorites = Array.isArray(req.body?.favoriteIds)
    ? req.body.favoriteIds.filter((id) => typeof id === 'string')
    : [];
  const watched = Array.isArray(req.body?.watchedIds)
    ? req.body.watchedIds.filter((id) => typeof id === 'string')
    : [];
  const profileIds = [...new Set([...favorites, ...watched])];
  const profileVector = {};

  for (const [id, weight] of [
    ...favorites.map((id) => [id, 2.5]),
    ...watched.map((id) => [id, 1.5]),
  ]) {
    const movie = movieFeatures.get(id);
    if (!movie) continue;
    for (const [term, value] of Object.entries(vectorFor(movie))) {
      profileVector[term] = (profileVector[term] || 0) + value * weight;
    }
  }

  const candidates = movies
    .filter((movie) => !profileIds.includes(movie.id))
    .map((movie) => {
      const availability = movie.showtimes.some((showtime) => showtime.city === city) ? 1 : 0;
      const similarity = cosine(profileVector, vectorFor(movieFeatures.get(movie.id)));
      const popularity = movie.rating / 10;
      const score = profileIds.length ? similarity * 0.72 + popularity * 0.2 + availability * 0.08 : popularity * 0.9 + availability * 0.1;
      return {
        id: movie.id,
        score: Number(score.toFixed(4)),
        reason: profileIds.length && similarity > 0.12
          ? `Similar genre, language or cast to your picks`
          : availability
            ? `Popular with CineBook fans · showing in ${city}`
            : 'A top-rated CineBook pick',
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, 4);

  return res.json({ success: true, algorithm: 'local-content-tfidf-cosine', recommendations: candidates });
});

app.listen(PORT, '127.0.0.1', () => console.log(`recommendation service listening on ${PORT}`));
