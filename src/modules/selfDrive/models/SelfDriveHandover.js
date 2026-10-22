import mongoose from "mongoose";

const handoverSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "self_drive_bookings",
      required: true,
      unique: true,
      index: true,
    },
    odometer: { type: Number, required: true },
    fuelLevel: { type: Number, default: null },
    batteryLevel: { type: Number, default: null },
    photos: { type: [String], default: [] },
    existingDamage: { type: String, default: "" },
    accessories: { type: [String], default: [] },
    notes: { type: String, default: "" },
    ownerConfirmedAt: { type: Date, default: null },
    customerConfirmedAt: { type: Date, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("self_drive_handovers", handoverSchema);
