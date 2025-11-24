import {
  sendMessageService,
  getMessagesService,
  markAsReadService,
  getUnreadCountService,
  getChatableBookingsService,
} from "../services/chatService.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { getIO } from "../socket.js";
import Booking from "../models/Booking.js";

/**
 * Gửi tin nhắn
 */
export const sendMessage = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id;

    // Gửi tin nhắn và lưu vào DB
    const chatMessage = await sendMessageService(bookingId, senderId, message);

    // Populate sender info
    await chatMessage.populate("senderId", "fullName avatar role");

    // Emit real-time qua Socket.IO
    try {
      const io = getIO();
      
      // Lấy thông tin booking để xác định receiver
      const booking = await Booking.findById(bookingId);
      if (booking) {
        // Xác định receiver
        const receiverId = booking.customerId.toString() === senderId.toString()
          ? booking.driverId.toString()
          : booking.customerId.toString();

        // Chuẩn bị data tin nhắn
        const messageData = {
          message: chatMessage,
          bookingId: bookingId,
        };

        // Emit đến room booking
        const roomName = `booking:${bookingId}`;
        io.to(roomName).emit("newChatMessage", messageData);

        // Emit đến room user của receiver để đảm bảo họ nhận được ngay cả khi chưa mở chat
        io.to(`user:${receiverId}`).emit("newChatMessage", messageData);

        // Lấy số sockets để debug
        const bookingRoomSockets = await io.in(roomName).fetchSockets();
        const receiverRoomSockets = await io.in(`user:${receiverId}`).fetchSockets();

        console.log(`[API] Chat message sent in booking ${bookingId} by user ${senderId} to receiver ${receiverId}`);
        console.log(`[API] Emitted to room: ${roomName} (${bookingRoomSockets.length} sockets) and user:${receiverId} (${receiverRoomSockets.length} sockets)`);
      }
    } catch (socketError) {
      // Nếu có lỗi với socket, vẫn trả về success vì tin nhắn đã được lưu vào DB
      console.error("Error emitting chat message via socket:", socketError);
    }

    res.status(201).json(
      successResponse("Gửi tin nhắn thành công", {
        message: chatMessage,
      })
    );
  } catch (error) {
    console.error("Error in sendMessage controller:", error);
    res.status(error.statusCode || 500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        error.statusCode || 500
      )
    );
  }
};

/**
 * Lấy danh sách tin nhắn của một booking
 */
export const getMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const messages = await getMessagesService(bookingId, userId);

    res.status(200).json(
      successResponse("Lấy danh sách tin nhắn thành công", {
        messages,
        count: messages.length,
      })
    );
  } catch (error) {
    console.error("Error in getMessages controller:", error);
    res.status(error.statusCode || 500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        error.statusCode || 500
      )
    );
  }
};

/**
 * Đánh dấu tin nhắn đã đọc
 */
export const markAsRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    await markAsReadService(bookingId, userId);

    res.status(200).json(successResponse("Đã đánh dấu tin nhắn đã đọc"));
  } catch (error) {
    console.error("Error in markAsRead controller:", error);
    res.status(error.statusCode || 500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        error.statusCode || 500
      )
    );
  }
};

/**
 * Lấy số tin nhắn chưa đọc
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const { unreadCount } = await getUnreadCountService(userId);

    res.status(200).json(
      successResponse("Lấy số tin nhắn chưa đọc thành công", {
        unreadCount,
      })
    );
  } catch (error) {
    console.error("Error in getUnreadCount controller:", error);
    res.status(500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        500
      )
    );
  }
};

/**
 * Lấy danh sách booking có thể chat
 */
export const getChatableBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await getChatableBookingsService(userId);

    res.status(200).json(
      successResponse("Lấy danh sách booking có thể chat thành công", {
        bookings,
        count: bookings.length,
      })
    );
  } catch (error) {
    console.error("Error in getChatableBookings controller:", error);
    res.status(500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        500
      )
    );
  }
};

