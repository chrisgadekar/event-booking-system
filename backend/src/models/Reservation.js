import mongoose from 'mongoose';

export const RESERVATION_STATUS = {
  ACTIVE: 'active',
  BOOKED: 'booked',
  CANCELLED: 'cancelled',
};

const reservationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    seatNumbers: { type: [String], required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUS),
      default: RESERVATION_STATUS.ACTIVE,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Reservation', reservationSchema);
