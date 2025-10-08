import Notification from "../models/Notification.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import { createAndSendNotification } from '../services/notificationService.js';

// Lấy tất cả thông báo của người dùng hiện tại
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(successResponse("Lấy thông báo thành công", notifications));
  } catch (error) {
    res.status(500).json(errorResponse("Lỗi máy chủ", 500));
  }
};

// Đánh dấu một hoặc nhiều thông báo là đã đọc
export const markNotificationsAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body; // Expect an array of IDs

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json(errorResponse("Vui lòng cung cấp danh sách ID thông báo", 400));
    }

    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId: req.user.id },
      { $set: { isRead: true } }
    );
    res.status(200).json(successResponse("Đánh dấu đã đọc thành công"));
  } catch (error) {
    res.status(500).json(errorResponse("Lỗi máy chủ", 500));
  }
};