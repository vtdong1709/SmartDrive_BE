import mongoose from "mongoose";
import { BOOKING_TYPE, PAYMENT_METHOD, PAYMENT_STATUS, RIDE_STATUS } from "../constants.js";

const locSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true },
    placeId: { type: String, default: null },
  },
  { _id: false }
);

const stopSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["PICKUP", "STOP", "DESTINATION"], required: true },
    location: { type: locSchema, required: true },
    sequence: { type: Number, required: true },
  },
  { _id: true }
);

const schema = new mongoose.Schema(
  {
    rideCode: { type: String, unique: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "ride_hailing_vehicles", default: null },
    vehicleCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ride_vehicle_categories", required: true },
    categoryCode: { type: String, required: true, index: true },
    bookingType: { type: String, enum: Object.values(BOOKING_TYPE), required: true },
    pickupLocation: { type: locSchema, required: true },
    destinationLocation: { type: locSchema, required: true },
    stops: { type: [stopSchema], default: [] },
    scheduledAt: { type: Date, default: null, index: true },
    searchStartedAt: { type: Date, default: null },
    estimatedDistance: { type: Number, default: 0 },
    estimatedDuration: { type: Number, default: 0 },
    actualDistance: { type: Number, default: null },
    actualDuration: { type: Number, default: null },
    quotedFare: { type: Number, required: true },
    finalFare: { type: Number, default: null },
    fareBreakdown: { type: Object, default: {} },
    currency: { type: String, default: "VND" },
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), default: PAYMENT_METHOD.VNPAY },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
    payment: {
      provider: String,
      orderCode: Number,
      amount: Number,
      checkoutUrl: String,
      paidAt: Date,
    },
    status: { type: String, enum: Object.values(RIDE_STATUS), default: RIDE_STATUS.SEARCHING_DRIVER, index: true },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
    cancelledBy: { type: String, default: null },
    cancellationFee: { type: Number, default: 0 },
    driverArrivedAt: { type: Date, default: null },
    tripStartedAt: { type: Date, default: null },
    tripCompletedAt: { type: Date, default: null },
    searchRadiusKm: { type: Number, default: 2 },
    offeredDriverIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "ride_quotes", default: null },
    pricingQuoteId: { type: String, default: null },
    pricingSnapshot: { type: Object, default: null },
    earnings: { type: Object, default: null },
    statusHistory: {
      type: [{ status: String, at: Date, by: String }],
      default: [],
    },
  },
  { timestamps: true }
);

schema.index({ status: 1, createdAt: -1 });
schema.index({ "payment.orderCode": 1 });
schema.index({ driverId: 1, status: 1 });

schema.pre("save", async function (next) {
  if (this.rideCode) return next();
  const now = new Date();
  const prefix = `RID${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("ride_bookings").countDocuments({ createdAt: { $gte: start, $lte: end } });
  this.rideCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("ride_bookings", schema);
