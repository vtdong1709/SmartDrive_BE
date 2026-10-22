import mongoose from "mongoose";
import { VEHICLE_TYPES } from "../constants.js";

const seatSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    row: { type: Number, required: true },
    column: { type: Number, required: true },
    seatType: { type: String, default: "standard" },
    isDriverSeat: { type: Boolean, default: false },
    isBookable: { type: Boolean, default: true },
    defaultPriceModifier: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { _id: true }
);

const windowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    plate: { type: String, required: true, trim: true, uppercase: true },
    color: { type: String, trim: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    seats: { type: [seatSchema], default: [] },
    charterEnabled: { type: Boolean, default: false },
    charterWindows: { type: [windowSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vehicleSchema.index({ driverId: 1, plate: 1 }, { unique: true });

export default mongoose.model("shared_ride_vehicles", vehicleSchema);
