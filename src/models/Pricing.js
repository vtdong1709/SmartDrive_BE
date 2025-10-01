import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    enum: ["hourly", "daily", "intercity"], // Loại dịch vụ
    required: true,
  },
  baseFare: { type: Number, default: 0 }, // Giá mở cửa
  perKm: { type: Number, default: 0 },     // Giá theo km (nếu áp dụng)
  perHour: { type: Number, default: 0 },   // Giá theo giờ (nếu áp dụng)
  perDay: { type: Number, default: 0 },    // Giá theo ngày (nếu áp dụng)
  waitingFeePerMin: { type: Number, default: 0 }, // Giá chờ/phút

  // Hệ số nhân cho từng điều kiện đặc biệt
  multipliers: {
    night: { type: Number, default: 1 },    // Ví dụ 1.2 = tăng 20% ban đêm
    weekend: { type: Number, default: 1 },  // Ví dụ 1.5 = tăng 50% cuối tuần
    holiday: { type: Number, default: 1 },  // Ví dụ 1.4 = tăng 40% ngày lễ
  },

  // Thời gian áp dụng (nếu cần, ví dụ chỉ trong tháng này)
  effectiveFrom: { type: Date, default: Date.now },
  effectiveTo: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("Pricing", pricingSchema);
