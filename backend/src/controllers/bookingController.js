import Seat, { SEAT_STATUS } from '../models/Seat.js';
import Reservation, { RESERVATION_STATUS } from '../models/Reservation.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { releaseExpiredSeats } from '../utils/releaseExpiredSeats.js';
import { withTransaction } from '../utils/withTransaction.js';

// POST /api/bookings
// Body: { reservationId }
export const confirmBooking = asyncHandler(async (req, res) => {
  const { reservationId } = req.body;
  const userId = req.user._id;

  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new ApiError(404, 'Reservation not found');
  }

  if (reservation.userId.toString() !== userId.toString()) {
    throw new ApiError(403, 'This reservation belongs to another user');
  }

  if (reservation.status === RESERVATION_STATUS.BOOKED) {
    throw new ApiError(409, 'This reservation has already been booked');
  }

  // An expired hold must never convert to a booking.
  if (
    reservation.status !== RESERVATION_STATUS.ACTIVE ||
    reservation.expiresAt.getTime() <= Date.now()
  ) {
    await releaseExpiredSeats(reservation.eventId);
    reservation.status = RESERVATION_STATUS.CANCELLED;
    await reservation.save();
    throw new ApiError(410, 'Your reservation has expired. Please select seats again.');
  }

  // Promote the held seats to booked and close the reservation as one atomic
  // unit. On a replica set this runs in a real transaction; on a standalone
  // MongoDB it falls back to a conditional update plus manual compensation.
  await withTransaction(async (session) => {
    const result = await Seat.updateMany(
      {
        eventId: reservation.eventId,
        seatNumber: { $in: reservation.seatNumbers },
        status: SEAT_STATUS.RESERVED,
        reservedBy: userId,
      },
      { $set: { status: SEAT_STATUS.BOOKED, bookedBy: userId, reservedUntil: null } },
      { session }
    );

    if (result.modifiedCount !== reservation.seatNumbers.length) {
      // The hold lapsed mid-request and lost one or more seats.
      if (session) {
        // Transaction: throwing aborts and rolls everything back automatically.
        throw new ApiError(
          409,
          'Some seats could not be confirmed because the hold expired. Please try again.'
        );
      }
      // Standalone: undo the seats we just booked in this request.
      await Seat.updateMany(
        {
          eventId: reservation.eventId,
          seatNumber: { $in: reservation.seatNumbers },
          status: SEAT_STATUS.BOOKED,
          bookedBy: userId,
        },
        {
          $set: {
            status: SEAT_STATUS.RESERVED,
            bookedBy: null,
            reservedBy: userId,
            reservedUntil: reservation.expiresAt,
          },
        }
      );
      throw new ApiError(
        409,
        'Some seats could not be confirmed because the hold expired. Please try again.'
      );
    }

    await Reservation.updateOne(
      { _id: reservation._id },
      { $set: { status: RESERVATION_STATUS.BOOKED } },
      { session }
    );
  });

  res.status(201).json({
    booking: {
      reservationId: reservation._id,
      eventId: reservation.eventId,
      seatNumbers: reservation.seatNumbers,
      bookedAt: new Date(),
    },
  });
});

// GET /api/bookings
// Returns the current user's confirmed bookings, most recent first.
export const listBookings = asyncHandler(async (req, res) => {
  const reservations = await Reservation.find({
    userId: req.user._id,
    status: RESERVATION_STATUS.BOOKED,
  })
    .sort({ updatedAt: -1 })
    .populate('eventId', 'name venue startsAt')
    .lean();

  const bookings = reservations
    .filter((r) => r.eventId) // guard against a deleted event
    .map((r) => ({
      id: r._id,
      event: r.eventId,
      seatNumbers: r.seatNumbers,
      bookedAt: r.updatedAt,
    }));

  res.json({ bookings });
});
