import express from "express";
import {
  chat,
  clearChatHistory,
  getChatHistory,
} from "../controllers/chatbotController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: API chatbot hỗ trợ người dùng về ứng dụng SmartDrive
 */

/**
 * @swagger
 * /api/chatbot/chat:
 *   post:
 *     summary: Gửi tin nhắn đến chatbot
 *     description: |
 *       Gửi tin nhắn đến chatbot và nhận phản hồi. Chatbot chỉ trả lời các câu hỏi về ứng dụng SmartDrive.
 *       Mỗi người dùng cần có một sessionId duy nhất để lưu lịch sử chat.
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - sessionId
 *             properties:
 *               message:
 *                 type: string
 *                 description: Tin nhắn của người dùng
 *                 example: "Làm thế nào để đăng ký tài khoản?"
 *               sessionId:
 *                 type: string
 *                 description: ID phiên làm việc của người dùng (có thể là userId hoặc một ID duy nhất)
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: Phản hồi từ chatbot thành công
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
 *                   example: "Tin nhắn đã được xử lý thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     response:
 *                       type: string
 *                       description: Phản hồi từ chatbot
 *                       example: "Để đăng ký tài khoản, bạn cần..."
 *                     sessionId:
 *                       type: string
 *                       example: "user123"
 *       400:
 *         description: Thiếu thông tin hoặc dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Vui lòng nhập tin nhắn!"
 *                 code:
 *                   type: integer
 *                   example: 400
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Có lỗi xảy ra, vui lòng thử lại sau"
 *                 code:
 *                   type: integer
 *                   example: 500
 */
router.post("/chat", chat);

/**
 * @swagger
 * /api/chatbot/history/{sessionId}:
 *   get:
 *     summary: Lấy lịch sử chat của một session
 *     description: Lấy toàn bộ lịch sử chat của một sessionId cụ thể
 *     tags: [Chatbot]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phiên làm việc của người dùng
 *         example: "user123"
 *     responses:
 *       200:
 *         description: Lấy lịch sử chat thành công
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
 *                   example: "Lấy lịch sử chat thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       example: "user123"
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                             enum: [user, assistant]
 *                           content:
 *                             type: string
 *                     count:
 *                       type: integer
 *                       example: 4
 *       400:
 *         description: Thiếu sessionId
 *       500:
 *         description: Lỗi server
 */
router.get("/history/:sessionId", getChatHistory);

/**
 * @swagger
 * /api/chatbot/clear-history:
 *   post:
 *     summary: Xóa lịch sử chat của một session
 *     description: Xóa toàn bộ lịch sử chat của một sessionId cụ thể
 *     tags: [Chatbot]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: ID phiên làm việc của người dùng
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: Xóa lịch sử chat thành công
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
 *                   example: "Đã xóa lịch sử chat thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       example: "user123"
 *       400:
 *         description: Thiếu sessionId
 *       500:
 *         description: Lỗi server
 */
router.post("/clear-history", clearChatHistory);

export default router;

