import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    code: String,
    label: String,
    amount: Number,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    quoteCode: { type: String, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null, index: true },
    service: { type: String, required: true, index: true },
    subType: { type: String, default: null },
    pricingVersionId: { type: String, default: null },
    inputSnapshot: { type: Object, default: {} },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true },
    multiplier: { type: Number, default: 1 },
    platformFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalFare: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    amountPayableNow: { type: Number, default: null },
    currency: { type: String, default: "VND" },
    distanceKm: { type: Number, default: null },
    durationSeconds: { type: Number, default: null },
    metadata: { type: Object, default: {} },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

schema.pre("save", function (next) {
  if (this.quoteCode) return next();
  this.quoteCode = `QT_${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
  next();
});

export default mongoose.model("pricing_quotes", schema);
