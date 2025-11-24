import ChatMessage from "../models/ChatMessage.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

// Các trạng thái booking cho phép chat
const ALLOWED_BOOKING_STATUSES = ["Confirmed", "Arriving", "Ongoing"];

/**
 * Kiểm tra xem booking có cho phép chat không
 */
const validateBookingForChat = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId).populate(
    "customerId driverId",
    "fullName"
  );

  if (!booking) {
    throw Object.assign(new Error("Không tìm thấy booking"), {
      statusCode: 404,
    });
  }

  // Kiểm tra user có phải là customer hoặc driver của booking không
  const isCustomer = booking.customerId._id.toString() === userId.toString();
  const isDriver = booking.driverId._id.toString() === userId.toString();

  if (!isCustomer && !isDriver) {
    throw Object.assign(
      new Error("Bạn không có quyền chat trong booking này"),
      { statusCode: 403 }
    );
  }

  // Kiểm tra trạng thái booking
  if (!ALLOWED_BOOKING_STATUSES.includes(booking.status)) {
    throw Object.assign(
      new Error(
        `Không thể chat. Booking đang ở trạng thái "${booking.status}". Chỉ có thể chat khi tài xế đã nhận chuyến (Confirmed, Arriving, Ongoing).`
      ),
      { statusCode: 400 }
    );
  }

  return { booking, isCustomer, isDriver };
};

/**
 * Gửi tin nhắn
 */
export const sendMessageService = async (bookingId, senderId, message) => {
  if (!message || !message.trim()) {
    throw Object.assign(new Error("Tin nhắn không được để trống"), {
      statusCode: 400,
    });
  }

  // Kiểm tra booking và quyền
  const { booking, isCustomer, isDriver } = await validateBookingForChat(
    bookingId,
    senderId
  );

  // Xác định receiver
  const receiverId = isCustomer
    ? booking.driverId._id
    : booking.customerId._id;

  // Tạo tin nhắn
  const chatMessage = await ChatMessage.create({
    bookingId,
    senderId,
    receiverId,
    message: message.trim(),
  });

  // Populate thông tin sender
  await chatMessage.populate("senderId", "fullName avatar");

  return chatMessage;
};

/**
 * Lấy danh sách tin nhắn của một booking
 */
export const getMessagesService = async (bookingId, userId) => {
  // Kiểm tra booking và quyền
  await validateBookingForChat(bookingId, userId);

  // Lấy tất cả tin nhắn của booking, sắp xếp theo thời gian
  const messages = await ChatMessage.find({ bookingId })
    .populate("senderId", "fullName avatar role")
    .sort({ createdAt: 1 });

  return messages;
};

/**
 * Đánh dấu tin nhắn đã đọc
 */
export const markAsReadService = async (bookingId, userId) => {
  // Kiểm tra booking và quyền
  await validateBookingForChat(bookingId, userId);

  // Đánh dấu tất cả tin nhắn gửi đến user này là đã đọc
  await ChatMessage.updateMany(
    {
      bookingId,
      receiverId: userId,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );

  return { success: true };
};

/**
 * Lấy số tin nhắn chưa đọc của user
 */
export const getUnreadCountService = async (userId) => {
  // Lấy tất cả booking mà user là customer hoặc driver
  const bookings = await Booking.find({
    $or: [{ customerId: userId }, { driverId: userId }],
    status: { $in: ALLOWED_BOOKING_STATUSES },
  }).select("_id");

  const bookingIds = bookings.map((b) => b._id);

  if (bookingIds.length === 0) {
    return { unreadCount: 0 };
  }

  // Đếm tin nhắn chưa đọc
  const unreadCount = await ChatMessage.countDocuments({
    bookingId: { $in: bookingIds },
    receiverId: userId,
    isRead: false,
  });

  return { unreadCount };
};

/**
 * Lấy danh sách booking có thể chat của user
 */
export const getChatableBookingsService = async (userId) => {
  const bookings = await Booking.find({
    $or: [{ customerId: userId }, { driverId: userId }],
    status: { $in: ALLOWED_BOOKING_STATUSES },
  })
    .populate("customerId", "fullName avatar")
    .populate("driverId", "fullName avatar")
    .sort({ createdAt: -1 });

  // Lấy số tin nhắn chưa đọc cho mỗi booking
  const bookingsWithUnread = await Promise.all(
    bookings.map(async (booking) => {
      const unreadCount = await ChatMessage.countDocuments({
        bookingId: booking._id,
        receiverId: userId,
        isRead: false,
      });

      // Lấy tin nhắn cuối cùng
      const lastMessage = await ChatMessage.findOne({
        bookingId: booking._id,
      })
        .sort({ createdAt: -1 })
        .populate("senderId", "fullName")
        .select("message createdAt senderId");

      return {
        booking: {
          _id: booking._id,
          bookingCode: booking.bookingCode,
          customerId: booking.customerId,
          driverId: booking.driverId,
          status: booking.status,
          pickupLocation: booking.pickupLocation,
          dropoffLocation: booking.dropoffLocation,
          createdAt: booking.createdAt,
        },
        unreadCount,
        lastMessage: lastMessage
          ? {
              message: lastMessage.message,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
            }
          : null,
      };
    })
  );

  return bookingsWithUnread;
};

