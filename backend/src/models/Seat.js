import mongoose from 'mongoose';

export const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  BOOKED: 'booked',
};

const seatSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    seatNumber: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SEAT_STATUS),
      default: SEAT_STATUS.AVAILABLE,
      index: true,
    },
    // Set while the seat is held by a reservation.
    reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reservedUntil: { type: Date, default: null },
    // Set once the seat is booked.
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// A seat number is unique within an event.
seatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model('Seat', seatSchema);
