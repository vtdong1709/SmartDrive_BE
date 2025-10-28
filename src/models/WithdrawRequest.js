import mongoose from "mongoose";

const WithdrawRequestSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "driver_transactions",
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 10000, // rút tối thiểu 10k
    },

    bankInfo: {
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
      bankName: { type: String, required: true },
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },

    adminNote: {
      type: String,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

WithdrawRequestSchema.index({ driver: 1, status: 1 });

export default mongoose.model("withdraw_requests", WithdrawRequestSchema);
