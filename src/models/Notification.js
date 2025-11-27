
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["info", "booking", "request", "warning", "payment", "system"],
      default: "info",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    meta: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
