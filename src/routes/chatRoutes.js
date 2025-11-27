import express from "express";
import {
  sendMessage,
  getMessages,
  markAsRead,
  getUnreadCount,
  getChatableBookings,
} from "../controllers/chatController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: API chat giữa tài xế và khách hàng
 */

/**
 * @swagger
 * /api/chat/bookings:
 *   get:
 *     summary: Lấy danh sách booking có thể chat
 *     description: |
 *       Lấy danh sách các booking mà user có thể chat (chỉ booking có status Confirmed, Arriving, hoặc Ongoing).
 *       Mỗi booking sẽ kèm theo số tin nhắn chưa đọc và tin nhắn cuối cùng.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách booking có thể chat thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookings:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.get("/bookings", authenticate, getChatableBookings);

/**
 * @swagger
 * /api/chat/unread-count:
 *   get:
 *     summary: Lấy số tin nhắn chưa đọc
 *     description: Lấy tổng số tin nhắn chưa đọc của user trong tất cả các booking có thể chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy số tin nhắn chưa đọc thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy số tin nhắn chưa đọc thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.get("/unread-count", authenticate, getUnreadCount);

/**
 * @swagger
 * /api/chat/{bookingId}/messages:
 *   get:
 *     summary: Lấy danh sách tin nhắn của một booking
 *     description: |
 *       Lấy tất cả tin nhắn trong một booking cụ thể.
 *       Chỉ có thể lấy tin nhắn nếu user là customer hoặc driver của booking đó,
 *       và booking phải ở trạng thái Confirmed, Arriving, hoặc Ongoing.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của booking
 *     responses:
 *       200:
 *         description: Lấy danh sách tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy danh sách tin nhắn thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           bookingId:
 *                             type: string
 *                           senderId:
 *                             type: object
 *                           receiverId:
 *                             type: string
 *                           message:
 *                             type: string
 *                           isRead:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *       400:
 *         description: Booking không ở trạng thái cho phép chat
 *       403:
 *         description: Không có quyền truy cập booking này
 *       404:
 *         description: Không tìm thấy booking
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.get("/:bookingId/messages", authenticate, getMessages);

/**
 * @swagger
 * /api/chat/{bookingId}/send:
 *   post:
 *     summary: Gửi tin nhắn
 *     description: |
 *       Gửi tin nhắn trong một booking.
 *       Chỉ có thể gửi tin nhắn nếu user là customer hoặc driver của booking đó,
 *       và booking phải ở trạng thái Confirmed, Arriving, hoặc Ongoing.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Nội dung tin nhắn
 *                 example: "Xin chào, tôi đang ở đây rồi"
 *     responses:
 *       201:
 *         description: Gửi tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Gửi tin nhắn thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: object
 *       400:
 *         description: Tin nhắn trống hoặc booking không ở trạng thái cho phép chat
 *       403:
 *         description: Không có quyền gửi tin nhắn trong booking này
 *       404:
 *         description: Không tìm thấy booking
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.post("/:bookingId/send", authenticate, sendMessage);

/**
 * @swagger
 * /api/chat/{bookingId}/mark-read:
 *   post:
 *     summary: Đánh dấu tin nhắn đã đọc
 *     description: |
 *       Đánh dấu tất cả tin nhắn trong một booking là đã đọc.
 *       Chỉ có thể đánh dấu nếu user là customer hoặc driver của booking đó.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của booking
 *     responses:
 *       200:
 *         description: Đánh dấu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đã đánh dấu tin nhắn đã đọc"
 *       403:
 *         description: Không có quyền truy cập booking này
 *       404:
 *         description: Không tìm thấy booking
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server
 */
router.post("/:bookingId/mark-read", authenticate, markAsRead);

export default router;

