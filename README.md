# SortMyScene — Event Ticket Booking

A simplified event ticket booking flow focused on **seat reservation** and **booking
confirmation**. Users browse events, pick seats from a live seat map, hold them for a
limited time, and confirm the booking before the hold expires.

- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Frontend:** React (Vite), React Router, Axios
- **Auth:** JWT-based register / login

---

## Features

- Browse events with live "seats left" counts
- Interactive, colour-coded seat map (available / selected / reserved / booked)
- Select multiple seats and **Reserve** them for a 10-minute hold
- Live **countdown timer** on the active hold
- **Confirm booking** before the timer runs out
- **Cancel a hold** to release seats back to the pool immediately
- **Resume an in-progress hold** after a page refresh
- **Live seat map** — polls for updates so seats taken by others appear in near real time
- **My Bookings** page listing confirmed bookings
- Toast notifications, loading skeletons, mobile-friendly layout, 404 + error boundary
- JWT auth, rate limiting, security headers, server-side validation on every endpoint

---

## Project structure

```
sortmyscene-booking/
├── backend/                # Express API + MongoDB models
├── frontend/               # React (Vite) client
├── docker-compose.yml      # Full stack: Mongo + API + web
└── .github/workflows/ci.yml
```

---

## Prerequisites

- **Node.js 18+**
- **MongoDB**, or **Docker** for the bundled compose files

---

## Quick start with Docker (whole stack)

```bash
docker compose up --build
docker compose exec backend npm run seed   # one-time sample data
```

- Web: **http://localhost:8080**
- API: **http://localhost:5000**

Demo login: **`demo@sortmyscene.test`** / **`password123`**

---

## Running locally (without Docker for the apps)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # JWT_SECRET is required

# Start MongoDB (single-node replica set → enables transactions):
docker compose up -d        # backend/docker-compose.yml, Mongo only

npm run seed                # load 3 events + demo user
npm run dev                 # API on http://localhost:5000
```

> No replica set handy? A plain standalone MongoDB works too — the booking flow
> detects the lack of transaction support and falls back automatically.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL defaults to http://localhost:5000/api
npm run dev                 # app on http://localhost:5173
```

---

## Scripts

**Backend**

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Start the API with auto-reload               |
| `npm start`      | Start the API                                |
| `npm run seed`   | Reset and load sample data                   |
| `npm test`       | Integration tests (in-memory replica set)    |
| `npm run lint`   | ESLint                                       |
| `npm run format` | Prettier                                     |

**Frontend**: `npm run dev` · `npm run build` · `npm run lint` · `npm run format`

---

## API reference

| Method | Endpoint                  | Auth | Description                                   |
| ------ | ------------------------- | ---- | --------------------------------------------- |
| POST   | `/api/auth/register`      | —    | Create an account, returns a JWT              |
| POST   | `/api/auth/login`         | —    | Log in, returns a JWT                         |
| GET    | `/api/auth/me`            | ✅   | Current user                                  |
| GET    | `/api/events`             | —    | List events with available-seat counts       |
| GET    | `/api/events/:id`         | —    | Single event + full seat map                  |
| POST   | `/api/reserve`            | ✅   | Hold seats for 10 minutes                     |
| GET    | `/api/reserve/active`     | ✅   | Current user's active hold (for rehydration)  |
| DELETE | `/api/reserve/:id`        | ✅   | Release a hold immediately                    |
| POST   | `/api/bookings`           | ✅   | Confirm a reservation → seats become booked   |
| GET    | `/api/bookings`           | ✅   | Current user's confirmed bookings             |

**Reserve** body: `{ "eventId": "...", "seatNumbers": ["A1", "A2"] }`
**Bookings** body: `{ "reservationId": "..." }`

---

## Data model

- **Event** — `name`, `description`, `venue`, `startsAt`, `totalSeats`, plus `rows` /
  `seatsPerRow` used to render the grid.
- **Seat** — `eventId`, `seatNumber`, `status` (`available` | `reserved` | `booked`),
  `reservedBy`, `reservedUntil`, `bookedBy`. Unique index on `{ eventId, seatNumber }`.
- **Reservation** — `userId`, `eventId`, `seatNumbers`, `expiresAt`, `status`.
- **User** — `name`, `email` (unique), `passwordHash`.

---

## Design decisions

### How double booking is prevented

Each seat is its own document with a `status` field. When a user reserves, the API
claims **each seat with a single atomic, conditional update**:

```js
Seat.findOneAndUpdate(
  { eventId, seatNumber, status: 'available' },   // only if still free
  { $set: { status: 'reserved', reservedBy, reservedUntil } }
)
```

MongoDB guarantees a single-document update is atomic, so for any given seat **only one
concurrent request can ever flip it** from `available` to `reserved`. The loser gets
`null`. This is proven by a test that fires 8 simultaneous reservation requests for the
same seat and asserts exactly one succeeds. If a multi-seat request can't secure **all**
requested seats, the seats it did grab are released and the whole request fails with
`409`, so a user never holds a partial selection.

### Atomic booking with transactions

Confirming a booking promotes the held seats from `reserved → booked` **and** closes the
reservation as one unit. On a replica set this runs inside a **MongoDB transaction**, so
the whole confirm is all-or-nothing. On a standalone MongoDB (no transaction support) it
transparently falls back to a conditional `updateMany` plus manual compensation. Seats are
only promoted where `status: 'reserved'` **and** `reservedBy` matches the user, so a lapsed
hold can never be converted into a booking.

### How expiry is handled

Holds last 10 minutes (`RESERVATION_MINUTES`). Rather than a background job, expiry is
enforced **lazily**: before any read or write that depends on availability, the API resets
seats whose `reservedUntil` is in the past back to `available` and cancels their
reservations. Booking additionally re-checks `expiresAt` and returns `410 Gone` if lapsed.

### Stale-state handling on the client

The seat map is re-fetched on every reserve/booking conflict and polled on an interval, so
the user always acts against current availability; a selected seat taken by someone else is
dropped from the selection with a toast. The countdown returns the UI to selection when the
hold expires. An active hold is rehydrated from `GET /api/reserve/active` after a refresh.

### Security

- Passwords hashed with bcrypt; auth via JWT (`Authorization: Bearer`).
- `helmet` security headers and CORS restricted to the configured client origin.
- `express-rate-limit` throttles auth and write endpoints.
- Required config (`JWT_SECRET`) is validated at startup.

---

## Assumptions

- A single MongoDB instance is sufficient. Double-booking safety relies on atomic
  single-document updates; transactions are used for booking when available and gracefully
  skipped otherwise.
- The seat map uses polling rather than websockets — adequate for this scope.
- "Basic authentication" is email/password with JWTs stored in `localStorage`.
- Seat numbers follow a `RowLetter + Number` scheme (e.g. `A1`, `B5`), derived from each
  event's `rows` × `seatsPerRow`.
