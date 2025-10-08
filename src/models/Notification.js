import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "auth_success",
        "driver_pending",
        "driver_approved",
        "driver_rejected",
        "booking_created",
        "booking_cancelled",
        "booking_paid",
        "general",
      ],
      default: "general",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("notifications", notificationSchema);
export default Notification;