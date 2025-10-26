import mongoose from "mongoose";

const personalSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    phone: { type: String },
    email: { type: String, lowercase: true, trim: true },
    idNumber: { type: String }, // CCCD/CMND
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    province: { type: String, trim: true }, // Tỉnh/Thành phố
    district: { type: String, trim: true }, // Quận/Huyện
    ward: { type: String, trim: true }, // Phường/Xã
    specificAddress: { type: String, trim: true }, // Địa chỉ cụ thể
  },
  { _id: false }
);

// vehicle info removed from application

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
    personal: { type: personalSchema },
    address: { type: addressSchema },
    documents: { type: documentsSchema, default: {} },
    licenseNumber: { type: String, default: null },
    licenseExpiry: { type: Date, default: null },
    yearsExperience: { type: Number, min: 0, default: 0 },
    services: {
      type: [String],
      enum: [
        "dich_vu_tai_xe_theo_gio",      // Dịch vụ tài xế theo giờ
        "dich_vu_tai_xe_theo_cay_so",   // Dịch vụ tài xế theo cây số
        "dich_vu_tai_xe_theo_ngay",     // Dịch vụ tài xế theo ngày
        "dich_vu_tai_xe_lien_tinh",     // Dịch vụ tài xế liên tỉnh
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
