import mongoose from "mongoose";

const DriverWalletSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true, // mỗi tài xế có 1 ví duy nhất
    },

    balance: {
      type: Number,
      default: 0, // số dư khả dụng
      min: 0,
    },

    debt: {
      type: Number,
      default: 0, // nợ do hệ thống trừ hoa hồng từ cuốc thanh toán trực tiếp
      min: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0, // tổng thu nhập tích lũy
      min: 0,
    },

    totalWithdrawn: {
      type: Number,
      default: 0, // tổng tiền đã rút
      min: 0,
    },

    isLocked: {
      type: Boolean,
      default: false, // khóa nếu nợ vượt hạn hoặc gian lận
    },

    lockReason: {
      type: String,
      default: null,
    },
    bankAccount: {
      numberBank: {
        type: String,
        required: true,
      },
      bankName: {
        type: String,
        required: true,
      },
    },
    lastTopupRequest: {
      orderCode: Number,
      amount: Number,
      bank: {
        bankName: String,
        accountNumber: String,
        accountName: String,
      },
      qrCode: String,
      checkoutUrl: String,
      description: String,
      status: {
        type: String,
        enum: ["pending", "success", "failed"],
        default: "pending",
      },
      createdAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("driver_wallets", DriverWalletSchema);
