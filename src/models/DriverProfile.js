import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
  },
  { _id: false }
);

const driverProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", unique: true, required: true },
    approved: { type: Boolean, default: false },
    availability: { type: String, enum: ["online", "offline"], default: "offline" },
    location: { type: locationSchema, default: undefined },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "driverapplications", default: null },
  },
  { timestamps: true }
);

driverProfileSchema.index({ location: "2dsphere" });

const DriverProfile = mongoose.model("driverprofiles", driverProfileSchema);
export default DriverProfile;


