import mongoose from "mongoose";
import { AVAILABILITY_TYPE } from "../constants.js";

const availabilitySchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "self_drive_vehicles",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AVAILABILITY_TYPE),
      required: true,
    },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    recurring: {
      enabled: { type: Boolean, default: false },
      daysOfWeek: { type: [Number], default: [] },
      startHm: { type: String, default: null },
      endHm: { type: String, default: null },
    },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  },
  { timestamps: true }
);

availabilitySchema.index({ vehicleId: 1, type: 1, startAt: 1, endAt: 1 });

export default mongoose.model("self_drive_availabilities", availabilitySchema);
