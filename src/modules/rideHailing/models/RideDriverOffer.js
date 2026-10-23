import mongoose from "mongoose";
import { OFFER_STATUS } from "../constants.js";

const schema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "ride_bookings", required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    offeredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(OFFER_STATUS), default: OFFER_STATUS.PENDING, index: true },
    distanceKm: { type: Number, default: null },
  },
  { timestamps: true }
);

schema.index({ rideId: 1, driverId: 1 });

export default mongoose.model("ride_driver_offers", schema);
