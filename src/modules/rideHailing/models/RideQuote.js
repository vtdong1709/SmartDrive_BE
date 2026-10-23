import mongoose from "mongoose";

const loc = {
  latitude: Number,
  longitude: Number,
  address: String,
  placeId: String,
};

const schema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    categoryCode: { type: String, required: true },
    bookingType: { type: String, required: true },
    scheduledAt: { type: Date, default: null },
    pickup: loc,
    destination: loc,
    stops: { type: [loc], default: [] },
    distanceKm: Number,
    durationMinutes: Number,
    breakdown: { type: Object, default: {} },
    estimatedFare: Number,
    expiresAt: { type: Date, required: true, index: true },
    pricingQuoteId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("ride_quotes", schema);
