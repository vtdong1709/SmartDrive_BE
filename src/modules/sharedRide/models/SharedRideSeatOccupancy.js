import mongoose from "mongoose";
import { OCCUPANCY_STATUS } from "../constants.js";

const occupancySchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "shared_ride_trips",
      required: true,
      index: true,
    },
    seatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    seatCode: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    pickupDistance: { type: Number, required: true },
    dropoffDistance: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OCCUPANCY_STATUS),
      default: OCCUPANCY_STATUS.HELD,
      index: true,
    },
    holdId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_seat_holds", default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_bookings", default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

occupancySchema.index({ tripId: 1, seatId: 1, status: 1 });
occupancySchema.index({ tripId: 1, pickupDistance: 1, dropoffDistance: 1 });

export default mongoose.model("shared_ride_seat_occupancies", occupancySchema);
