import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "ride_bookings", required: true, unique: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("ride_ratings", schema);
