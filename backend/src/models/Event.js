import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    venue: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    totalSeats: { type: Number, required: true, min: 1 },
    // Layout used to render the seat grid on the client.
    rows: { type: Number, required: true, min: 1 },
    seatsPerRow: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

export default mongoose.model('Event', eventSchema);
