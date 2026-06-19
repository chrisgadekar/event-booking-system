// End-to-end test of the booking flow against a real in-memory MongoDB.
// Run with: npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test_secret';
process.env.RESERVATION_MINUTES = '10';

const { connectDB } = await import('../src/config/db.js');
const { createApp } = await import('../src/app.js');
const { default: Event } = await import('../src/models/Event.js');
const { default: Seat, SEAT_STATUS } = await import('../src/models/Seat.js');
const { default: User } = await import('../src/models/User.js');
const { default: Reservation } = await import('../src/models/Reservation.js');

let mongod;
let server;
let baseUrl;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function makeEvent() {
  const event = await Event.create({
    name: 'Test Show',
    venue: 'Test Hall',
    startsAt: new Date('2026-09-01T19:00:00'),
    rows: 2,
    seatsPerRow: 5,
    totalSeats: 10,
  });
  const seats = [];
  for (const row of ['A', 'B']) {
    for (let c = 1; c <= 5; c += 1) {
      seats.push({ eventId: event._id, seatNumber: `${row}${c}` });
    }
  }
  await Seat.insertMany(seats);
  return event;
}

test.before(async () => {
  // A replica set lets us exercise the real transaction path used by booking.
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(mongod.getUri());
  const app = createApp({ nodeEnv: 'test' });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  server.close();
});

test.beforeEach(async () => {
  await Promise.all([
    Event.deleteMany({}),
    Seat.deleteMany({}),
    User.deleteMany({}),
    Reservation.deleteMany({}),
  ]);
});

async function registerUser(email) {
  const { json } = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'User', email, password: 'password123' },
  });
  return json.token;
}

test('rejects reservation without authentication', async () => {
  const event = await makeEvent();
  const { status } = await api('/api/reserve', {
    method: 'POST',
    body: { eventId: event._id, seatNumbers: ['A1'] },
  });
  assert.equal(status, 401);
});

test('happy path: reserve then book', async () => {
  const token = await registerUser('happy@test.com');
  const event = await makeEvent();

  const reserve = await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['A1', 'A2'] },
  });
  assert.equal(reserve.status, 201);
  const reservationId = reserve.json.reservation._id;

  const seats = await Seat.find({ eventId: event._id, seatNumber: { $in: ['A1', 'A2'] } });
  assert.ok(seats.every((s) => s.status === SEAT_STATUS.RESERVED));

  const booking = await api('/api/bookings', {
    method: 'POST',
    token,
    body: { reservationId },
  });
  assert.equal(booking.status, 201);

  const booked = await Seat.find({ eventId: event._id, seatNumber: { $in: ['A1', 'A2'] } });
  assert.ok(booked.every((s) => s.status === SEAT_STATUS.BOOKED));
});

test('cannot reserve a seat already reserved by someone else', async () => {
  const tokenA = await registerUser('a@test.com');
  const tokenB = await registerUser('b@test.com');
  const event = await makeEvent();

  const first = await api('/api/reserve', {
    method: 'POST',
    token: tokenA,
    body: { eventId: event._id, seatNumbers: ['A1'] },
  });
  assert.equal(first.status, 201);

  const second = await api('/api/reserve', {
    method: 'POST',
    token: tokenB,
    body: { eventId: event._id, seatNumbers: ['A1'] },
  });
  assert.equal(second.status, 409);
});

test('concurrent reservations for the same seat: exactly one wins', async () => {
  const event = await makeEvent();
  const tokens = await Promise.all(
    Array.from({ length: 8 }, (_, i) => registerUser(`race${i}@test.com`))
  );

  const results = await Promise.all(
    tokens.map((token) =>
      api('/api/reserve', {
        method: 'POST',
        token,
        body: { eventId: event._id, seatNumbers: ['A1'] },
      })
    )
  );

  const winners = results.filter((r) => r.status === 201);
  assert.equal(winners.length, 1, 'exactly one reservation should succeed');

  const seat = await Seat.findOne({ eventId: event._id, seatNumber: 'A1' });
  assert.equal(seat.status, SEAT_STATUS.RESERVED);
});

test('expired reservation cannot be booked', async () => {
  const token = await registerUser('expired@test.com');
  const event = await makeEvent();

  const reserve = await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['A1'] },
  });
  const reservationId = reserve.json.reservation._id;

  // Force the hold into the past.
  await Reservation.findByIdAndUpdate(reservationId, {
    expiresAt: new Date(Date.now() - 1000),
  });
  await Seat.updateOne(
    { eventId: event._id, seatNumber: 'A1' },
    { reservedUntil: new Date(Date.now() - 1000) }
  );

  const booking = await api('/api/bookings', {
    method: 'POST',
    token,
    body: { reservationId },
  });
  assert.equal(booking.status, 410);

  // The seat should be released back to available.
  const seat = await Seat.findOne({ eventId: event._id, seatNumber: 'A1' });
  assert.equal(seat.status, SEAT_STATUS.AVAILABLE);
});

test('cancelling a reservation releases the seats immediately', async () => {
  const token = await registerUser('cancel@test.com');
  const event = await makeEvent();

  const reserve = await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['A1', 'A2'] },
  });
  const reservationId = reserve.json.reservation._id;

  const cancel = await api(`/api/reserve/${reservationId}`, { method: 'DELETE', token });
  assert.equal(cancel.status, 200);

  const seats = await Seat.find({ eventId: event._id, seatNumber: { $in: ['A1', 'A2'] } });
  assert.ok(seats.every((s) => s.status === SEAT_STATUS.AVAILABLE));

  // The freed seats can be reserved again right away.
  const again = await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['A1'] },
  });
  assert.equal(again.status, 201);
});

test('active reservation can be looked up for rehydration', async () => {
  const token = await registerUser('active@test.com');
  const event = await makeEvent();

  await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['B1'] },
  });

  const active = await api(`/api/reserve/active?eventId=${event._id}`, { token });
  assert.equal(active.status, 200);
  assert.ok(active.json.reservation);
  assert.deepEqual(active.json.reservation.seatNumbers, ['B1']);
});

test('confirmed bookings are listed for the user', async () => {
  const token = await registerUser('list@test.com');
  const event = await makeEvent();

  const reserve = await api('/api/reserve', {
    method: 'POST',
    token,
    body: { eventId: event._id, seatNumbers: ['A3'] },
  });
  await api('/api/bookings', {
    method: 'POST',
    token,
    body: { reservationId: reserve.json.reservation._id },
  });

  const list = await api('/api/bookings', { token });
  assert.equal(list.status, 200);
  assert.equal(list.json.bookings.length, 1);
  assert.deepEqual(list.json.bookings[0].seatNumbers, ['A3']);
  assert.equal(list.json.bookings[0].event.name, 'Test Show');
});

test('partial availability rolls back and reserves nothing', async () => {
  const tokenA = await registerUser('pa@test.com');
  const tokenB = await registerUser('pb@test.com');
  const event = await makeEvent();

  await api('/api/reserve', {
    method: 'POST',
    token: tokenA,
    body: { eventId: event._id, seatNumbers: ['A2'] },
  });

  // B asks for A1 (free) and A2 (taken) — the whole request must fail.
  const res = await api('/api/reserve', {
    method: 'POST',
    token: tokenB,
    body: { eventId: event._id, seatNumbers: ['A1', 'A2'] },
  });
  assert.equal(res.status, 409);

  const a1 = await Seat.findOne({ eventId: event._id, seatNumber: 'A1' });
  assert.equal(a1.status, SEAT_STATUS.AVAILABLE, 'A1 must not be left reserved');
});
