import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { linkTelegramAccount } from "../controllers/telegramController.js";

const router = express.Router();

/**
 * @swagger
 * /api/telegram/link:
 *   post:
 *     summary: Link Telegram account to SmartDrive user
 *     tags: [Telegram]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: string
 *                 example: "123456789"
 *               username:
 *                 type: string
 *                 example: smartdrive_user
 *     responses:
 *       200:
 *         description: Telegram linked successfully
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
 *                   example: "Telegram linked successfully"
 */
router.post("/link", authenticate, linkTelegramAccount);

export default router;