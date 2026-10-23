import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    name: { type: String, required: true },
    maxPassengers: { type: Number, required: true },
    energyType: { type: String, required: true },
    kind: { type: String, required: true },
    minSeats: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    baseFare: { type: Number, required: true },
    minimumFare: { type: Number, required: true },
    perKmRate: { type: Number, required: true },
    perMinuteRate: { type: Number, required: true },
    bookingFee: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    surgeMultiplier: { type: Number, default: 1 },
    sortOrder: { type: Number, default: 0 },
    iconKey: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ride_vehicle_categories", schema);
