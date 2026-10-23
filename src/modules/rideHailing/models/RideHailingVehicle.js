import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, unique: true, index: true },
    kind: { type: String, enum: ["MOTORBIKE", "CAR", "EV"], required: true },
    seatCount: { type: Number, required: true },
    energyType: { type: String, required: true },
    plate: { type: String, required: true, uppercase: true },
    make: { type: String, default: "" },
    model: { type: String, default: "" },
    color: { type: String, default: "" },
    verified: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ride_hailing_vehicles", schema);
