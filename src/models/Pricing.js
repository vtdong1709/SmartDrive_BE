import mongoose from "mongoose";

// const pricingSchema = new mongoose.Schema({
//   serviceType: {
//     type: String,
//     enum: ["hourly", "daily", "intercity"], // Loại dịch vụ
//     required: true,
//   },
//   baseFare: { type: Number, default: 0 }, // Giá mở cửa
//   perKm: { type: Number, default: 0 },     // Giá theo km (nếu áp dụng)
//   perHour: { type: Number, default: 0 },   // Giá theo giờ (nếu áp dụng)
//   perDay: { type: Number, default: 0 },    // Giá theo ngày (nếu áp dụng)
//   waitingFeePerMin: { type: Number, default: 0 }, // Giá chờ/phút

//   // Hệ số nhân cho từng điều kiện đặc biệt
//   multipliers: {
//     night: { type: Number, default: 1 },    // Ví dụ 1.2 = tăng 20% ban đêm
//     weekend: { type: Number, default: 1 },  // Ví dụ 1.5 = tăng 50% cuối tuần
//     holiday: { type: Number, default: 1 },  // Ví dụ 1.4 = tăng 40% ngày lễ
//   },

//   // Thời gian áp dụng (nếu cần, ví dụ chỉ trong tháng này)
//   effectiveFrom: { type: Date, default: Date.now },
//   effectiveTo: { type: Date, default: null },
// }, { timestamps: true });

const pricingSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["per_km", "hourly", "daily", "intercity"],
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
