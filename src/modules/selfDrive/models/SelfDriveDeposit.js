import mongoose from "mongoose";
import { DEPOSIT_STATUS, PAYMENT_STATUS } from "../constants.js";

const depositSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "self_drive_bookings",
      required: true,
      unique: true,
      index: true,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    amount: { type: Number, required: true },
    deductedAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(DEPOSIT_STATUS),
      default: DEPOSIT_STATUS.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    payment: {
      provider: { type: String, enum: ["vnpay", "payos", null], default: null },
      orderCode: Number,
      amount: Number,
      checkoutUrl: String,
      description: String,
      paidAt: Date,
    },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

depositSchema.index({ "payment.orderCode": 1 });

export default mongoose.model("self_drive_deposits", depositSchema);
