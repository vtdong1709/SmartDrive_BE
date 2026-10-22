import mongoose from "mongoose";
import {
  BODY_TYPE,
  FUEL_TYPE,
  TRANSMISSION,
  VEHICLE_STATUS,
} from "../constants.js";

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    caption: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  },
  { _id: true, timestamps: true }
);

const discountRuleSchema = new mongoose.Schema(
  {
    minDays: { type: Number, required: true },
    rate: { type: Number, required: true },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    plate: { type: String, required: true, trim: true, uppercase: true },
    color: { type: String, trim: true },
    seatCount: { type: Number, required: true, min: 2 },
    transmission: { type: String, enum: TRANSMISSION, required: true },
    fuelType: { type: String, enum: FUEL_TYPE, required: true },
    bodyType: { type: String, enum: BODY_TYPE, default: "sedan" },
    location: {
      address: { type: String, required: true },
      geo: { type: geoPointSchema, required: true },
    },
    status: {
      type: String,
      enum: Object.values(VEHICLE_STATUS),
      default: VEHICLE_STATUS.DRAFT,
      index: true,
    },
    instantBookingEnabled: { type: Boolean, default: false },
    dailyPrice: { type: Number, required: true, min: 0 },
    hourlyOveragePrice: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    dailyMileageLimit: { type: Number, default: 200 },
    excessMileagePrice: { type: Number, default: 0 },
    lateFeePerHour: { type: Number, default: 0 },
    insuranceDaily: { type: Number, default: 0 },
    turnaroundMinutes: { type: Number, default: 60 },
    deliveryEnabled: { type: Boolean, default: false },
    deliveryRadius: { type: Number, default: 0 },
    deliveryPricing: {
      baseFee: { type: Number, default: 0 },
      perKm: { type: Number, default: 0 },
    },
    longDiscountRules: { type: [discountRuleSchema], default: [] },
    photos: { type: [photoSchema], default: [] },
    publishedAt: { type: Date, default: null },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

vehicleSchema.index({ "location.geo": "2dsphere" });
vehicleSchema.index({ ownerId: 1, plate: 1 }, { unique: true });
vehicleSchema.index({ status: 1, dailyPrice: 1, seatCount: 1 });

export default mongoose.model("self_drive_vehicles", vehicleSchema);
