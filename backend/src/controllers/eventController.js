import Event from '../models/Event.js';
import Seat, { SEAT_STATUS } from '../models/Seat.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { releaseExpiredSeats } from '../utils/releaseExpiredSeats.js';

// GET /api/events
export const listEvents = asyncHandler(async (_req, res) => {
  const events = await Event.find().sort({ startsAt: 1 }).lean();

  // Attach a live availability count to each event card.
  const withCounts = await Promise.all(
    events.map(async (event) => {
      await releaseExpiredSeats(event._id);
      const availableSeats = await Seat.countDocuments({
        eventId: event._id,
        status: SEAT_STATUS.AVAILABLE,
      });
      return { ...event, availableSeats };
    })
  );

  res.json({ events: withCounts });
});

// GET /api/events/:id
export const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id).lean();
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  // Free any lapsed holds so the seat map reflects reality.
  await releaseExpiredSeats(event._id);

  const seats = await Seat.find({ eventId: event._id })
    .sort({ seatNumber: 1 })
    .select('seatNumber status')
    .lean();

  res.json({ event, seats });
});
