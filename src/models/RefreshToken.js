import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: true
});

// TTL index: tự động xóa document khi expiresAt <= hiện tại
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model("refreshtokens", refreshTokenSchema);
export default RefreshToken;
