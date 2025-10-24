import Notification from "../models/Notification.js";
import redis from "../redis.js";

/**
 * Lấy tất cả thông báo của người dùng
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // lấy từ JWT hoặc middleware auth
    const cached = await redis.lrange(`notifications:${userId}`, 0, -1);

    let notifications;

    if (cached && cached.length > 0) {
      notifications = cached.map((item) => JSON.parse(item));
    } else {
      notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
      // Cache vào Redis (nếu cần)
      for (const n of notifications) {
        await redis.lpush(`notifications:${userId}`, JSON.stringify(n));
      }
    }

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Đánh dấu đã đọc một thông báo
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Đánh dấu tất cả đã đọc
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.updateMany({ userId, read: false }, { read: true });
    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Xóa một thông báo
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await Notification.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
