import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { getMyNotifications, markNotificationsAsRead } from "../controllers/notificationController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 * - name: Notifications
 * description: API quản lý thông báo
 */

/**
 * @swagger
 * /api/notifications/me:
 *   get:
 *     summary: Lấy tất cả thông báo của tôi
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Thành công
 */
router.get("/me", authenticate, getMyNotifications);

/**
 * @swagger
 * /api/notifications/read:
 *   patch:
 *     summary: Đánh dấu đã đọc thông báo
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notificationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["653fd3b7a1c2e3456789abcd", "653fd3b7a1c2e3456789abce"]
 *     responses:
 *       '200':
 *         description: Thành công
 */
router.patch("/read", authenticate, markNotificationsAsRead);

export default router;