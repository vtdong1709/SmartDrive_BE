import mongoose from "mongoose";

const damageSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    photos: { type: [String], default: [] },
    estimatedFee: { type: Number, default: 0 },
  },
  { _id: true }
);

const returnSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "self_drive_bookings",
      required: true,
      unique: true,
      index: true,
    },
    returnOdometer: { type: Number, required: true },
    fuelLevel: { type: Number, default: null },
    batteryLevel: { type: Number, default: null },
    actualReturnAt: { type: Date, required: true },
    photos: { type: [String], default: [] },
    damages: { type: [damageSchema], default: [] },
    notes: { type: String, default: "" },
    fuelFee: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    charges: { type: Object, default: {} },
    ownerConfirmedAt: { type: Date, default: null },
    customerConfirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("self_drive_returns", returnSchema);
