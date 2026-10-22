import mongoose from "mongoose";
import { CHARTER_STATUS, PAYMENT_STATUS } from "../constants.js";

const placeSchema = new mongoose.Schema(
  {
    address: String,
    latitude: Number,
    longitude: Number,
  },
  { _id: false }
);

const charterSchema = new mongoose.Schema(
  {
    charterCode: { type: String, unique: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_vehicles", required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_trips", default: null },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    pickup: { type: placeSchema, required: true },
    destination: { type: placeSchema, required: true },
    requestedDepartureAt: { type: Date, required: true, index: true },
    passengerCount: { type: Number, required: true },
    notes: { type: String, default: null },
    quotedPrice: { type: Number, required: true },
    pricing: { type: Object, default: {} },
    status: {
      type: String,
      enum: Object.values(CHARTER_STATUS),
      default: CHARTER_STATUS.PENDING_DRIVER_ACCEPTANCE,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    payment: {
      provider: { type: String, enum: ["vnpay", "payos", null], default: null },
      orderCode: Number,
      amount: Number,
      checkoutUrl: String,
      qrCode: String,
      description: String,
      paidAt: Date,
      createdAt: Date,
    },
    rejectReason: { type: String, default: null },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_tickets", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

charterSchema.index({ driverId: 1, requestedDepartureAt: 1, status: 1 });
charterSchema.index({ "payment.orderCode": 1 });

charterSchema.pre("save", async function (next) {
  if (this.charterCode) return next();
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SRC${yy}${mm}${dd}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("shared_ride_charters").countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  this.charterCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("shared_ride_charters", charterSchema);
