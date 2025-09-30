import mongoose from "mongoose";

const personalSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    idNumber: { type: String, required: true }, // CCCD/CMND
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    plate: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false }
);

const documentsSchema = new mongoose.Schema(
  {
    idFrontUrl: { type: String },
    idBackUrl: { type: String },
    driverLicenseFrontUrl: { type: String },
    driverLicenseBackUrl: { type: String },
  },
  { _id: false }
);

const driverApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      required: true,
    },
    rejectionReason: { type: String, default: null },
    personal: { type: personalSchema, required: true },
    vehicle: { type: vehicleSchema, required: true },
    documents: { type: documentsSchema, default: {} },
    licenseNumber: { type: String, default: null },
    licenseExpiry: { type: Date, default: null },
    yearsExperience: { type: Number, min: 0, default: 0 },
    services: {
      type: [String],
      enum: [
        "drive_by_hour",
        "city_service",
        "long_distance",
        "interprovincial_tourism",
        "vip",
        "premium_clients",
        "airport_pickup",
        "airport_specialist",
      ],
      default: [],
    },
    submittedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

driverApplicationSchema.index({ userId: 1, createdAt: -1 });
driverApplicationSchema.index({ status: 1, createdAt: -1 });
// Ensure at most one non-approved application per user
// Note: Multiple applications per user are allowed.

const DriverApplication = mongoose.model("driverapplications", driverApplicationSchema);
export default DriverApplication;




// Ensure legacy unique index on userId is removed to allow multiple applications per user
DriverApplication.collection
  .indexExists("userId_1")
  .then((exists) => {
    if (exists) {
      return DriverApplication.collection.dropIndex("userId_1");
    }
  })
  .catch(() => {
    // ignore if index doesn't exist or on startup race
  });
