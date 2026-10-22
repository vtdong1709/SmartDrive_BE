import mongoose from "mongoose";
import {
  BOOKING_STATUS,
  BOOKING_TYPE,
  PAYMENT_STATUS,
} from "../constants.js";

const placeSchema = new mongoose.Schema(
  {
    address: String,
    latitude: Number,
    longitude: Number,
    distanceFromOrigin: Number,
    estimatedAt: Date,
    deviationMeters: Number,
  },
  { _id: false }
);

const bookingSeatSchema = new mongoose.Schema(
  {
    seatId: { type: mongoose.Schema.Types.ObjectId, required: true },
    code: String,
    row: Number,
    column: Number,
    seatType: String,
    price: Number,
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, unique: true, index: true },
    type: {
      type: String,
      enum: Object.values(BOOKING_TYPE),
      default: BOOKING_TYPE.SHARED_SEAT,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "shared_ride_trips",
      required: true,
      index: true,
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    holdId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_seat_holds", default: null },
    seats: { type: [bookingSeatSchema], default: [] },
    pickup: { type: placeSchema, required: true },
    dropoff: { type: placeSchema, required: true },
    passengerCount: { type: Number, required: true },
    notes: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.AWAITING_PAYMENT,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    pricing: { type: Object, default: {} },
    totalAmount: { type: Number, required: true },
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
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "shared_ride_tickets", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    cancelledBy: { type: String, enum: ["passenger", "driver", "admin", "system", null], default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ tripId: 1, status: 1 });
bookingSchema.index({ passengerId: 1, createdAt: -1 });
bookingSchema.index({ "payment.orderCode": 1 });

bookingSchema.pre("save", async function (next) {
  if (this.bookingCode) return next();
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SRB${yy}${mm}${dd}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("shared_ride_bookings").countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  this.bookingCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("shared_ride_bookings", bookingSchema);
