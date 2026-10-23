import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    service: { type: String, required: true, index: true },
    partnerType: { type: String, default: "driver" },
    subType: { type: String, default: null },
    commissionType: { type: String, enum: ["PERCENT", "FIXED"], default: "PERCENT" },
    rate: { type: Number, default: 15 },
    fixedAmount: { type: Number, default: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("commission_plans", schema);
