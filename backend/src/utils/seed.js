import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Event from '../models/Event.js';
import Seat, { SEAT_STATUS } from '../models/Seat.js';
import Reservation from '../models/Reservation.js';
import User from '../models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sortmyscene';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const eventBlueprints = [
  {
    name: 'Indie Nights: The Local Stage',
    description: 'An intimate evening of live indie and acoustic sets.',
    venue: 'The Quarter, Bandra',
    startsAt: new Date('2026-07-12T19:30:00'),
    rows: 5,
    seatsPerRow: 8,
  },
  {
    name: 'Stand-Up Saturday',
    description: 'Three comedians, one mic, zero filters.',
    venue: 'Habitat, Khar',
    startsAt: new Date('2026-07-19T20:00:00'),
    rows: 6,
    seatsPerRow: 10,
  },
  {
    name: 'Symphony Under the Stars',
    description: 'A 40-piece orchestra performing film scores live.',
    venue: 'Jio Garden, BKC',
    startsAt: new Date('2026-08-02T18:00:00'),
    rows: 8,
    seatsPerRow: 12,
  },
];

function buildSeatNumbers(rows, seatsPerRow) {
  const seats = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 1; c <= seatsPerRow; c += 1) {
      seats.push(`${ROW_LABELS[r]}${c}`);
    }
  }
  return seats;
}

async function seed() {
  await connectDB(MONGO_URI);

  console.log('Clearing existing data...');
  await Promise.all([
    Event.deleteMany({}),
    Seat.deleteMany({}),
    Reservation.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log('Creating demo user (demo@sortmyscene.test / password123)...');
  await User.create({
    name: 'Demo User',
    email: 'demo@sortmyscene.test',
    passwordHash: await User.hashPassword('password123'),
  });

  for (const blueprint of eventBlueprints) {
    const totalSeats = blueprint.rows * blueprint.seatsPerRow;
    const event = await Event.create({ ...blueprint, totalSeats });

    const seatNumbers = buildSeatNumbers(blueprint.rows, blueprint.seatsPerRow);
    const seatDocs = seatNumbers.map((seatNumber) => ({
      eventId: event._id,
      seatNumber,
      status: SEAT_STATUS.AVAILABLE,
    }));
    await Seat.insertMany(seatDocs);

    console.log(`Seeded "${event.name}" with ${totalSeats} seats.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
