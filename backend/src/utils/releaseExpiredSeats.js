import Seat, { SEAT_STATUS } from '../models/Seat.js';
import Reservation, { RESERVATION_STATUS } from '../models/Reservation.js';

// Lazily frees seats whose hold has lapsed. Called before any read or write
// that depends on accurate seat availability, so an expired hold can never be
// booked and never blocks another user.
export async function releaseExpiredSeats(eventId) {
  const now = new Date();
  const filter = {
    status: SEAT_STATUS.RESERVED,
    reservedUntil: { $lt: now },
  };
  if (eventId) filter.eventId = eventId;

  await Seat.updateMany(filter, {
    $set: {
      status: SEAT_STATUS.AVAILABLE,
      reservedBy: null,
      reservedUntil: null,
    },
  });

  const reservationFilter = {
    status: RESERVATION_STATUS.ACTIVE,
    expiresAt: { $lt: now },
  };
  if (eventId) reservationFilter.eventId = eventId;

  await Reservation.updateMany(reservationFilter, {
    $set: { status: RESERVATION_STATUS.CANCELLED },
  });
}
