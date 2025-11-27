import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import {
  requestDeleteAccountOTP,
  confirmDeleteAccount,
} from "../controllers/deleteAccountController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Delete Account
 *     description: API xóa tài khoản
 */


/**
 * @swagger
 * /api/delete-account/request-otp:
 *   post:
 *     summary: Gửi mã OTP qua email để xác thực xóa tài khoản
 *     description: |
 *       Gửi mã OTP 6 chữ số đến email của người dùng để xác thực việc xóa tài khoản.
 *       Mã OTP có hiệu lực trong 5 phút.
 *       Người dùng cần phải đã xác thực email trước khi có thể yêu cầu xóa tài khoản.
 *     tags: [Delete Account]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP đã được gửi thành công
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
 *                   example: "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư."
 *       400:
 *         description: Tài khoản đã bị xóa rồi
 *       403:
 *         description: Tài khoản chưa được xác thực email
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi server
 */
router.post("/request-otp", authenticate, requestDeleteAccountOTP);

/**
 * @swagger
 * /api/delete-account/confirm:
 *   post:
 *     summary: Xác thực OTP và xóa tài khoản
 *     description: |
 *       Xác thực mã OTP và thực hiện xóa tài khoản. Tất cả dữ liệu nhạy cảm sẽ bị xóa hoặc anonymize hoàn toàn.
 *       
 *       **Dữ liệu bị xóa/anonymize:**
 *       - Tên: "Người dùng đã xóa"
 *       - Email: deleted_{userId}_{timestamp}@deleted.local
 *       - Số điện thoại: "0000000000"
 *       - Avatar: null
 *       - Ngày sinh: null
 *       - Giới tính: null
 *       - Địa chỉ đã lưu: []
 *       - RefreshToken: xóa tất cả
 *       - OTP: xóa tất cả
 *       - Notification: xóa tất cả
 *       - DriverApplication: anonymize personal info, address, documents
 *       - DriverWallet: lock và xóa bankAccount
 *       - ChatMessage: thay message thành "[Tin nhắn đã bị xóa]"
 *       - WithdrawRequest: anonymize bankInfo
 *       
 *       **Dữ liệu được giữ lại:**
 *       - User ID (để giữ tính toàn vẹn database)
 *       - Role
 *       - Password (đã hash)
 *       - Timestamps
 *       - Booking (lịch sử giao dịch)
 *       - DriverTransaction (lịch sử giao dịch)
 *     tags: [Delete Account]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otpCode
 *             properties:
 *               otpCode:
 *                 type: string
 *                 description: Mã OTP 6 chữ số nhận được qua email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Xóa tài khoản thành công
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
 *                   example: "Tài khoản đã được xóa thành công. Tất cả dữ liệu nhạy cảm đã bị xóa hoặc ẩn."
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: OTP không hợp lệ, đã hết hạn, hoặc tài khoản đã bị xóa
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
 *                   example: "OTP không đúng"
 *                 code:
 *                   type: integer
 *                   example: 400
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi server
 */
router.post("/confirm", authenticate, confirmDeleteAccount);

export default router;

