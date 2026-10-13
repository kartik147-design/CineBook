# CineBook

CineBook is a local-first movie booking demo built with React and independently running Node/Express services. Movie metadata and showtimes live in [frontend/src/data/movies.json](./frontend/src/data/movies.json). Posters are generated locally from each movie's accent color; the app makes no third-party movie, image, payment, or recommendation API calls.

## Run locally

The easiest way to run the complete development stack, including MongoDB, is Docker:

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Open `http://localhost:5000`. The browser uses that one origin for both the app and `/api`; Vite proxies API requests to the private backend gateway. MongoDB is persisted in the `cinebook-dev-mongo` volume.

By default, development uses the MongoDB container in Compose. To use MongoDB Atlas instead, put `MONGODB_URI` in the root `.env` file (use the replacement credentials after rotating any password shared in chat), then restart Compose. If the URI does not include credentials, also set `MONGODB_USERNAME` and `MONGODB_PASSWORD`. Keep `.env` private and do not commit it.

For native development, run MongoDB locally, then start the backend services:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
# Set unique development secrets in backend/.env.
npm start
```

In another terminal, start Vite on the shared browser-facing port:

```powershell
cd frontend
npm ci
npm run dev -- --host 0.0.0.0 --port 5000
```

Open `http://localhost:5000`. Vite serves the UI and proxies `/api` to the backend gateway on its private upstream port 5001. Set `CINEBOOK_PROXY_TARGET` to change that upstream.

## Docker environments

Docker Compose files at the repository root provide separate development, test, and staging setups. API requests use `/api`; Vite proxies them in development and Nginx proxies them in staging, so the browser uses one origin.

### Development

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Open `http://localhost:5000`. The frontend has Vite hot reload; backend services restart when backend source files change. The frontend and API share this single public port; the backend gateway and MongoDB are available only to other Compose services. Development uses local-only demo credentials and a separate `cinebook-dev-mongo` volume.

### Tests

```powershell
docker compose -f docker-compose.test.yml run --build --rm frontend-test
docker compose -f docker-compose.test.yml run --build --rm backend-test
```

The frontend test image runs ESLint and a production build. The backend test image runs the end-to-end integration suite against its MongoDB service, including persistence checks. These commands return a nonzero exit code on failure.

### Staging

Copy [.env.example](./.env.example) to `.env.staging`, then set unique, strong values for the MongoDB root password, admin password, and both application secrets:

```powershell
Copy-Item .env.example .env.staging
# Edit .env.staging before starting staging.
docker compose -f docker-compose.staging.yml --env-file .env.staging up --build -d
```

Open `http://localhost:5000`; the UI and API share that single public port. Staging data persists in the `cinebook-staging-mongo` volume. Stop it with `docker compose -f docker-compose.staging.yml --env-file .env.staging down`. Changing the MongoDB credentials does not change the credentials inside an existing MongoDB volume; rotate them in MongoDB or migrate the data before changing the environment values.

The simple root `docker-compose.yml` remains as a local single-machine convenience setup (`docker compose up --build`); its fallback credentials are for development only, not shared staging or production.

### GitHub Actions

- [CI](./.github/workflows/ci.yml) runs on pushes and pull requests: frontend lint/build, backend integration tests, Compose validation, and Docker image builds.
- [Staging image publishing](./.github/workflows/staging.yml) runs on pushes to `main` and can be started manually. It publishes the frontend and backend staging images to GitHub Container Registry (`ghcr.io`) with `staging` and commit-SHA tags. It prepares images; deploying them to a staging host requires a hosting target and is not configured by this repository.

## Backend services

- **API gateway** (`5001`, private upstream): HTTP API, authentication checks and internal service routing. The frontend proxy exposes the API on the same browser-facing port as the UI (`5000` by default).
- **Auth** (`5101`): signup/login, salted password hashes, signed expiring sessions and admin sign-in.
- **Seat inventory** (`5102`): seat holds, concurrent seat conflict checks, expiry and cancellation release.
- **Booking/ticketing** (`5103`): checkout orchestration, booking history, signed ticket QR payloads and verification.
- **Payment simulator** (`5104`): validates fictional demo payment inputs and returns demo references; never contacts a processor or stores card data.
- **Recommendations** (`5105`): local recommendation scoring using TF-IDF genre/language/cast features and cosine similarity against favourites and watch history.
- **Notifications** (`5106`): persistent in-app booking notification outbox; it does not send real email.

Auth, inventory, bookings, and notifications persist in separate MongoDB collections (`cinebook_users`, `cinebook_inventory`, `cinebook_bookings`, and `cinebook_notifications`) in the `cinebook` database. Docker environments require MongoDB and wait for it to become healthy before starting the backend. On first initialization, existing JSON store files are imported into MongoDB without overwriting an existing MongoDB collection; the old Compose data volumes are mounted read-only for this migration. Native development connects to the MongoDB URI in `backend/.env`; when `MONGODB_URI` is unset, the integration tests use isolated JSON files instead. Seat-hold and booking workflows still span services and are not a distributed transaction; add shared locking/transaction coordination before scaling beyond this demo deployment.

## Checkout and tickets

Seat selection leads to a separate checkout page. Seats become booked only when checkout is submitted and the inventory service atomically accepts the reservation. Choose **Pay at venue** to reserve without a demo payment, or select a simulator option. For **Demo card**, only the displayed test number `4242 4242 4242 4242`, a future expiry and CVV `123` are accepted. Never enter a real card number or CVV. Demo UPI handles must end in `@demo`; net-banking options are fictional.

Successful checkout issues a signed QR entry ticket. Find active and cancelled tickets in **My tickets**. Cancelling a ticket invalidates its QR and releases its seats. Admins can verify a pasted QR payload from the dashboard. Demo payment totals are not real revenue and no real money is collected.

## Recommendation concept

The recommendation service computes TF-IDF weights from movie genre, language and cast, builds a weighted profile from locally stored favourites and booked-movie history, and ranks unseen catalogue entries using cosine similarity plus a small rating/city-availability prior. With no user signals it falls back to popular local catalogue titles. All features and scoring are computed in CineBook's own code using the local JSON catalogue.