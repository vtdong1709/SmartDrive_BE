import mongoose from "mongoose";
import {
  PRICING_MODE,
  TRIP_STATUS,
  VEHICLE_TYPES,
} from "../constants.js";

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const placeSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    location: { type: geoPointSchema, required: true },
  },
  { _id: false }
);

const routePointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["origin", "stop", "destination", "waypoint"],
      default: "stop",
    },
    address: { type: String, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    sequence: { type: Number, required: true },
    distanceFromOrigin: { type: Number, default: 0 },
    estimatedArrivalAt: { type: Date, default: null },
    isOfficialStop: { type: Boolean, default: true },
  },
  { _id: true }
);

const tripSeatSchema = new mongoose.Schema(
  {
    vehicleSeatId: { type: mongoose.Schema.Types.ObjectId, default: null },
    code: { type: String, required: true },
    row: { type: Number, required: true },
    column: { type: Number, required: true },
    seatType: { type: String, default: "standard" },
    isDriverSeat: { type: Boolean, default: false },
    isBookable: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
    priceModifier: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const segmentPriceSchema = new mongoose.Schema(
  {
    fromSequence: { type: Number, required: true },
    toSequence: { type: Number, required: true },
    fromDistance: { type: Number, default: null },
    toDistance: { type: Number, default: null },
    price: { type: Number, required: true },
  },
  { _id: true }
);

const tripSchema = new mongoose.Schema(
  {
    tripCode: { type: String, unique: true, sparse: true, index: true },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "shared_ride_vehicles",
      required: true,
    },
    vehicleSnapshot: {
      name: String,
      plate: String,
      color: String,
      vehicleType: { type: String, enum: VEHICLE_TYPES },
      brand: String,
      model: String,
    },
    origin: { type: placeSchema, required: true },
    destination: { type: placeSchema, required: true },
    routePoints: { type: [routePointSchema], default: [] },
    routePolyline: { type: String, default: "" },
    routeDistance: { type: Number, default: 0 },
    routeDuration: { type: Number, default: 0 },
    departureAt: { type: Date, required: true, index: true },
    estimatedArrivalAt: { type: Date, default: null },
    boardingStartAt: { type: Date, default: null },
    bookingCutoffAt: { type: Date, default: null },
    allowSeatBooking: { type: Boolean, default: true },
    allowCharter: { type: Boolean, default: false },
    charterWindowStart: { type: String, default: null },
    charterWindowEnd: { type: String, default: null },
    maxPickupDeviationKm: { type: Number, default: 2 },
    maxDropoffDeviationKm: { type: Number, default: 2 },
    pricingMode: {
      type: String,
      enum: Object.values(PRICING_MODE),
      default: PRICING_MODE.FIXED_TRIP,
    },
    baseSeatPrice: { type: Number, default: 0 },
    pricePerKm: { type: Number, default: 0 },
    charterPrice: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    segmentPrices: { type: [segmentPriceSchema], default: [] },
    seats: { type: [tripSeatSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(TRIP_STATUS),
      default: TRIP_STATUS.DRAFT,
      index: true,
    },
    publishedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

tripSchema.index({ status: 1, departureAt: 1 });
tripSchema.index({ "origin.location": "2dsphere" });
tripSchema.index({ "destination.location": "2dsphere" });
tripSchema.index({ driverId: 1, status: 1, departureAt: -1 });

tripSchema.pre("save", async function (next) {
  if (this.tripCode) return next();
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SRT${yy}${mm}${dd}`;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const count = await mongoose.model("shared_ride_trips").countDocuments({
    createdAt: { $gte: start, $lte: end },
  });
  this.tripCode = `${prefix}${String(count + 1).padStart(4, "0")}`;
  next();
});

export default mongoose.model("shared_ride_trips", tripSchema);
