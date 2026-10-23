import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    service: { type: String, required: true, index: true },
    subType: { type: String, default: null, index: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "RETIRED"], default: "ACTIVE" },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    currency: { type: String, default: "VND" },
    rounding: { type: String, default: "NEAREST" },
    quoteTtlSeconds: { type: Number, default: null },
    rules: { type: Object, default: {} },
  },
  { timestamps: true }
);

schema.index({ service: 1, subType: 1, effectiveFrom: -1 });

export default mongoose.model("pricing_plans", schema);
