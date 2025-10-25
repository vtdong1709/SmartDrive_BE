import Notification from "../models/Notification.js";
import redis from "../redis.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

/**
 * Lấy tất cả thông báo của người dùng
 */
// export const getNotifications = async (req, res) => {
//   try {
//     const userId = req.user.id; // lấy từ JWT hoặc middleware auth
    
//     const cached = await redis.lrange(`notifications:${userId}`, 0, -1);

//     let notifications;

//     if (cached && cached.length > 0) {
//       notifications = cached.map((item) => JSON.parse(item));
//     } else {
//       notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
//       // Cache vào Redis (nếu cần)
//       for (const n of notifications) {
//         await redis.lpush(`notifications:${userId}`, JSON.stringify(n));
//       }
//     }

//      return res.status(200).json(successResponse("Lấy tất cả giá thành công.", notifications));
//   } catch (error) {
//     console.error("Error getting notifications:", error);
//     return res.status(500).json(errorResponse("Server error",error));
//   }
// };


export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy page và limit từ query, gán mặc định nếu không có
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Thử lấy từ cache Redis
    const cacheKey = `notifications:${userId}:page:${page}:limit:${limit}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const cachedData = JSON.parse(cached);
      return res
        .status(200)
        .json(successResponse("Lấy danh sách thông báo (cache) thành công.", cachedData));
    }

    // Nếu không có cache → lấy từ MongoDB
    const total = await Notification.countDocuments({ userId });
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Tính tổng số trang
    const totalPages = Math.ceil(total / limit);

    const result = {
      notifications,
      page,
      limit,
      total,
      totalPages
    };

    // Lưu cache Redis trong 1 phút
    await redis.setex(cacheKey, 60, JSON.stringify(result));

    return res.status(200).json(successResponse("Lấy danh sách thông báo thành công.", result));
  } catch (error) {
    console.error("Error getting notifications:", error);
    return res.status(500).json(errorResponse("Server error", error));
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
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json(errorResponse("Notification not found"));
    }

    return res.status(200).json(successResponse("đánh dấu đã đọc thành công", notification ));
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json(errorResponse("Server error", error));
  }
};

/**
 * Đánh dấu tất cả đã đọc
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    return res.status(200).json(successResponse("All notifications marked as read" ));
  } catch (error) {
    console.error("Error marking all notifications:", error);
    return res.status(500).json(errorResponse("Server error", error));
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
      return res.status(404).json(errorResponse("Notification not found"));
    }

    return res.status(200).json(successResponse("Notification deleted"));
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json(errorResponse("Server error"));
  }
};
