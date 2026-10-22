import mongoose from "mongoose";

const holdSchema = new mongoose.Schema(
  {
    holdCode: { type: String, unique: true, index: true },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "shared_ride_trips",
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    seatIds: [{ type: mongoose.Schema.Types.ObjectId, required: true }],
    pickup: {
      address: String,
      latitude: Number,
      longitude: Number,
      distanceFromOrigin: Number,
      estimatedAt: Date,
      deviationMeters: Number,
    },
    dropoff: {
      address: String,
      latitude: Number,
      longitude: Number,
      distanceFromOrigin: Number,
      estimatedAt: Date,
      deviationMeters: Number,
    },
    passengerCount: { type: Number, required: true },
    pricing: { type: Object, default: {} },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "CONVERTED", "EXPIRED", "RELEASED"],
      default: "ACTIVE",
      index: true,
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_bookings", default: null },
  },
  { timestamps: true }
);

holdSchema.index({ tripId: 1, userId: 1, status: 1 });

export default mongoose.model("shared_ride_seat_holds", holdSchema);
