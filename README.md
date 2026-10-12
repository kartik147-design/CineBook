# CineBook

CineBook is a local-first movie booking demo built with React and independently running Node/Express services. Movie metadata and showtimes live in [frontend/src/data/movies.json](./frontend/src/data/movies.json). Posters are generated locally from each movie's accent color; the app makes no third-party movie, image, payment, or recommendation API calls.

## Run locally

Start the backend services:

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env and replace the example secrets before starting the app.
npm start
```

The runner starts the API gateway on port 5000 and the local services on 5101–5106. Keep this terminal running.

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend uses `http://localhost:5000/api` by default. Set `VITE_API_URL` before starting Vite to use a different CineBook gateway URL.

## Run with Docker Compose

From the repository root, build and start the frontend and backend containers:

```powershell
docker compose up --build
```

Open `http://localhost:4173`; the API gateway is available at `http://localhost:5000`. Compose persists account, booking, and notification JSON data in the `cinebook-data` volume. Set `ADMIN_PASSWORD`, `CINEBOOK_AUTH_SECRET`, and `TICKET_SECRET` in the shell or a root `.env` file before running Compose; the built-in values are for local development only. If the app is hosted at a different address, set `VITE_API_URL` to that browser-accessible gateway URL and rebuild.

## Backend services

- **API gateway** (`5000`): public HTTP API, authentication checks and internal service routing.
- **Auth** (`5101`): signup/login, salted password hashes, signed expiring sessions and admin sign-in.
- **Seat inventory** (`5102`): seat holds, concurrent seat conflict checks, expiry and cancellation release.
- **Booking/ticketing** (`5103`): checkout orchestration, booking history, signed ticket QR payloads and verification.
- **Payment simulator** (`5104`): validates fictional demo payment inputs and returns demo references; never contacts a processor or stores card data.
- **Recommendations** (`5105`): local recommendation scoring using TF-IDF genre/language/cast features and cosine similarity against favourites and watch history.
- **Notifications** (`5106`): persistent in-app booking notification outbox; it does not send real email.

The services use separate JSON stores in `backend/data/` for this single-machine demo. JSON files and temporary writes are git-ignored. This storage and the in-memory seat-hold model are not designed for multi-server production; use a transactional database and shared lock/queue system before deploying at scale.

## Checkout and tickets

Seat selection leads to a separate checkout page. Seats become booked only when checkout is submitted and the inventory service atomically accepts the reservation. Choose **Pay at venue** to reserve without a demo payment, or select a simulator option. For **Demo card**, only the displayed test number `4242 4242 4242 4242`, a future expiry and CVV `123` are accepted. Never enter a real card number or CVV. Demo UPI handles must end in `@demo`; net-banking options are fictional.

Successful checkout issues a signed QR entry ticket. Find active and cancelled tickets in **My tickets**. Cancelling a ticket invalidates its QR and releases its seats. Admins can verify a pasted QR payload from the dashboard. Demo payment totals are not real revenue and no real money is collected.

## Recommendation concept

The recommendation service computes TF-IDF weights from movie genre, language and cast, builds a weighted profile from locally stored favourites and booked-movie history, and ranks unseen catalogue entries using cosine similarity plus a small rating/city-availability prior. With no user signals it falls back to popular local catalogue titles. All features and scoring are computed in CineBook's own code using the local JSON catalogue.