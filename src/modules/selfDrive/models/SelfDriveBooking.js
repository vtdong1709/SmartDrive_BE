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
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, unique: true, index: true },
    type: { type: String, enum: Object.values(BOOKING_TYPE), required: true },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "self_drive_vehicles",
      required: true,
      index: true,
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    deliveryRequested: { type: Boolean, default: false },
    deliveryLocation: { type: placeSchema, default: null },
    quote: { type: Object, default: {} },
    totalAmount: { type: Number, required: true },
    depositAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING_OWNER_APPROVAL,
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
    notes: { type: String, default: null },
    rejectReason: { type: String, default: null },
    cancelReason: { type: String, default: null },
    cancelledBy: { type: String, enum: ["customer", "owner", "admin", "system", null], default: null },
    vehicleSnapshot: { type: Object, default: {} },
  },
  { timestamps: true }
);

bookingSchema.index({ vehicleId: 1, status: 1, startAt: 1, endAt: 1 });
bookingSchema.index({ "payment.orderCode": 1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });

bookingSchema.pre("save", async function (next) {
  if (this.bookingCode) return next();
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SDR${yy}${mm}${dd}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("self_drive_bookings").countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  this.bookingCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("self_drive_bookings", bookingSchema);
