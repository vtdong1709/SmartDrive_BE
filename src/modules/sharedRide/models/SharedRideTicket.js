import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, unique: true, index: true },
    qrToken: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["SHARED_SEAT", "CHARTER"], required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_bookings", default: null },
    charterId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_charters", default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_trips", default: null },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    snapshot: { type: Object, default: {} },
  },
  { timestamps: true }
);

ticketSchema.pre("save", async function (next) {
  if (this.ticketCode) return next();
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `TKT${yy}${mm}${dd}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("shared_ride_tickets").countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  this.ticketCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("shared_ride_tickets", ticketSchema);
