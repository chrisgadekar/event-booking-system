import Event from '../models/Event.js';
import Seat, { SEAT_STATUS } from '../models/Seat.js';
import Reservation, { RESERVATION_STATUS } from '../models/Reservation.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { releaseExpiredSeats } from '../utils/releaseExpiredSeats.js';

// POST /api/reserve
// Body: { eventId, seatNumbers: string[] }
export const reserveSeats = asyncHandler(async (req, res) => {
  const { eventId, seatNumbers } = req.body;
  const userId = req.user._id;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  // Reclaim any seats whose hold lapsed so they can be reserved again.
  await releaseExpiredSeats(eventId);

  const holdMinutes = Number(process.env.RESERVATION_MINUTES) || 10;
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);

  // Claim each requested seat with an atomic, conditional update. Because the
  // filter requires status === 'available', only one request can ever flip a
  // given seat document — this is what prevents double booking. We collect the
  // seats we win and roll back if we cannot secure the full set.
  const claimed = [];
  for (const seatNumber of seatNumbers) {
    const seat = await Seat.findOneAndUpdate(
      { eventId, seatNumber, status: SEAT_STATUS.AVAILABLE },
      {
        $set: {
          status: SEAT_STATUS.RESERVED,
          reservedBy: userId,
          reservedUntil: expiresAt,
        },
      },
      { new: true }
    );

    if (seat) {
      claimed.push(seatNumber);
    }
  }

  // Partial success: release what we grabbed and report the conflict so the
  // client can refresh its seat map and let the user pick again.
  if (claimed.length !== seatNumbers.length) {
    if (claimed.length > 0) {
      await Seat.updateMany(
        { eventId, seatNumber: { $in: claimed }, reservedBy: userId },
        { $set: { status: SEAT_STATUS.AVAILABLE, reservedBy: null, reservedUntil: null } }
      );
    }
    const unavailable = seatNumbers.filter((s) => !claimed.includes(s));
    throw new ApiError(
      409,
      `These seats are no longer available: ${unavailable.join(', ')}`
    );
  }

  const reservation = await Reservation.create({
    userId,
    eventId,
    seatNumbers,
    expiresAt,
    status: RESERVATION_STATUS.ACTIVE,
  });

  res.status(201).json({ reservation });
});

// GET /api/reserve/active?eventId=...
// Lets the client rehydrate an in-progress hold after a page refresh.
export const getActiveReservation = asyncHandler(async (req, res) => {
  const { eventId } = req.query;
  await releaseExpiredSeats(eventId);

  const filter = {
    userId: req.user._id,
    status: RESERVATION_STATUS.ACTIVE,
    expiresAt: { $gt: new Date() },
  };
  if (eventId) filter.eventId = eventId;

  const reservation = await Reservation.findOne(filter).sort({ createdAt: -1 });
  res.json({ reservation: reservation || null });
});

// DELETE /api/reserve/:id
// Releases an active hold immediately so the seats return to the pool instead
// of staying locked until expiry.
export const cancelReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) {
    throw new ApiError(404, 'Reservation not found');
  }
  if (reservation.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'This reservation belongs to another user');
  }
  if (reservation.status === RESERVATION_STATUS.BOOKED) {
    throw new ApiError(409, 'This reservation has already been booked');
  }

  if (reservation.status === RESERVATION_STATUS.ACTIVE) {
    await Seat.updateMany(
      {
        eventId: reservation.eventId,
        seatNumber: { $in: reservation.seatNumbers },
        status: SEAT_STATUS.RESERVED,
        reservedBy: req.user._id,
      },
      { $set: { status: SEAT_STATUS.AVAILABLE, reservedBy: null, reservedUntil: null } }
    );
    reservation.status = RESERVATION_STATUS.CANCELLED;
    await reservation.save();
  }

  res.json({ message: 'Reservation released' });
});
