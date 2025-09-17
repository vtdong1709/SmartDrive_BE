import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    code: { type: String, required: true },
    type: {
      type: String,
      enum: ["verify_email", "reset_password"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },

  { timestamps: true }
);

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

const OTP = mongoose.model("otps", otpSchema);

export default OTP;
