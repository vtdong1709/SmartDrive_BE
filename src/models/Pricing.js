import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["per_km", "hourly", "daily", "intercity", "motorcycle"],
      required: true,
    },

    // --- Giá mở cửa ---
    baseFare: { type: Number, default: 50000 }, // 50.000 VNĐ

    // --- Bảng giá theo km (dùng cho per_km và intercity) ---
    fareBrackets: [
      {
        from: { type: Number, default: 0 },
        to: { type: Number, default: null },
        pricePerKm: { type: Number, required: true },
      },
    ],

    // --- Bảng giá theo giờ (hourly) ---
    hourBrackets: [
      {
        fromHour: { type: Number, default: 1 },
        toHour: { type: Number, default: null },
        pricePerHour: { type: Number, required: true },
      },
    ],

    // --- Bảng giá theo ngày (daily) ---
    dayBrackets: [
      {
        fromDay: { type: Number, default: 1 },
        toDay: { type: Number, default: null },
        pricePerDay: { type: Number, required: true },
      },
    ],

    // --- Giới hạn km và phụ phí vượt giới hạn ---
    maxKmPerHour: { type: Number, default: 25 },
    maxKmPerDay: { type: Number, default: 100 },
    surchargePerKm: { type: Number, default: 3000 }, // 5.000 VNĐ/km vượt

    // --- Phí quay đầu cho intercity ---
    turnBackFees: [
      {
        fromKm: { type: Number, default: 0 },
        toKm: { type: Number, default: null },
        fee: { type: Number, required: true },
      },
    ],

    // --- Phí chờ ---
    waitingFeePerMin: { type: Number, default: 2000 },

    // --- Hệ số nhân phụ phí ---
    multipliers: {
      after21h: { type: Number, default: 1.08 },
      after23h: { type: Number, default: 1.12 },
      weekend: { type: Number, default: 1.10 },
      holiday: { type: Number, default: 1.15 },
    },

    // --- Phí nền tảng ---
    platformFee: { type: Number, default: 30000 },

    // --- Thời gian hiệu lực ---
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
  },
  { timestamps: true }
);
export default mongoose.model("Pricing", pricingSchema);
