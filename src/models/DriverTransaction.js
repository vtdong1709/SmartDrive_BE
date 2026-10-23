import mongoose from "mongoose";

const DriverTransactionSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "driver_wallets",
      required: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null, // có thể null nếu không liên quan booking
    },

    withdrawRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "withdraw_requests",
      default: null, // chỉ có nếu đây là giao dịch rút tiền
    },

    type: {
      type: String,
      enum: [
        "booking_income", // tiền hệ thống trả sau khi trừ hoa hồng
        "commission_deduct", // hoa hồng bị trừ (cash trip)
        "withdraw", // tài xế rút tiền
        "adjustment", // admin điều chỉnh tay
        "shared_ride_income", // thu nhập xe ghép / bao xe
        "self_drive_income", // thu nhập cho thuê xe tự lái
        "ride_hailing_income", // thu nhập đặt xe di chuyển
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true, // số tiền thay đổi (+ hoặc -)
    },

    balanceBefore: {
      type: Number,
      required: true,
    },

    balanceAfter: {
      type: Number,
      required: true,
    },

    note: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

DriverTransactionSchema.index({ driver: 1, createdAt: -1 });
DriverTransactionSchema.index({ withdrawRequest: 1 });

export default mongoose.model("driver_transactions", DriverTransactionSchema);
