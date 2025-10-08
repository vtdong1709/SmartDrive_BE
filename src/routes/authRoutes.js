import express from "express";
import {
  destroyRefreshToken,
  login,
  refreshToken,
  register,
  resetPasswordController,
  sendOTPToEmailController,
  verifyEmailController,
} from "../controllers/authController.js";
import { validateRegister } from "../middlewares/validateAuth.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { getMyProfile } from "../controllers/userController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Các API liên quan đến xác thực và người dùng
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: Họ và tên người dùng
 *                 example: "Nguyễn Văn A"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email hợp lệ của người dùng
 *                 example: "nguyenvana@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Mật khẩu ít nhất 6 ký tự
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 description: Vai trò người dùng (mặc định là renter)
 *                 enum: [renter, staff, admin]
 *                 example: "renter"
 *     responses:
 *       201:
 *         description: Đăng ký thành công, trả về thông tin cơ bản của user
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
 *                   example: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "650f1c5d8b9c1a1234abcd56"
 *                     fullName:
 *                       type: string
 *                       example: "Nguyễn Văn A"
 *                     email:
 *                       type: string
 *                       example: "nguyenvana@example.com"
 *                     role:
 *                       type: string
 *                       example: "renter"
 *       400:
 *         description: Lỗi validate hoặc email đã tồn tại
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
 *                   example: "Email đã tồn tại"
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
router.post("/register", validateRegister, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập hệ thống
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về thông tin user + token
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
 *                   example: "Đăng nhập thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "650f1c5d8b9c1a1234abcd56"
 *                     fullName:
 *                       type: string
 *                       example: Nguyễn Văn A
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     role:
 *                       type: string
 *                       example: renter
 *                     accessToken:
 *                       type: string
 *                       description: JWT Access Token
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
 *                     refreshToken:
 *                       type: string
 *                       description: Refresh Token lưu DB
 *                       example: "def50200acbd12983..."
 *       400:
 *         description: Sai email hoặc mật khẩu / thiếu thông tin
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
 *                   example: "Sai email hoặc mật khẩu!"
 *                 code:
 *                   type: integer
 *                   example: 400
 *       500:
 *         description: Lỗi server
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/refreshToken:
 *   post:
 *     summary: Làm mới Access Token bằng Refresh Token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []   # Yêu cầu Bearer token trong header
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token hợp lệ còn hạn
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
 *     responses:
 *       200:
 *         description: Làm mới token thành công
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
 *                   example: "Làm mới token thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: Access token mới
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
 *       400:
 *         description: Lỗi validate hoặc refresh token không hợp lệ
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
 *                   example: "Refresh token không hợp lệ hoặc đã hết hạn!"
 *                 code:
 *                   type: integer
 *                   example: 400
 *       401:
 *         description: Token không hợp lệ hoặc hết hạn
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
 *                   example: "Unauthorized: Token không hợp lệ hoặc hết hạn"
 *                 code:
 *                   type: integer
 *                   example: 401
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
router.post("/refreshToken", authenticate, refreshToken);

/**
 * @swagger
 * /api/auth/destroyRefreshToken:
 *   post:
 *     summary: Xoá refresh token, sử dụng khi đăng xuất
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []   # Yêu cầu Bearer token trong header
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token cần xoá
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
 *     responses:
 *       200:
 *         description: Xoá refresh token thành công
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
 *                   example: "Xoá refresh token thành công!"
 *       400:
 *         description: Thiếu refresh token hoặc refresh token không hợp lệ
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
 *                   example: "Refresh token không hợp lệ hoặc đã bị xoá!"
 *                 code:
 *                   type: integer
 *                   example: 400
 *       401:
 *         description: Token không hợp lệ hoặc hết hạn
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
 *                   example: "Unauthorized: Token không hợp lệ hoặc hết hạn"
 *                 code:
 *                   type: integer
 *                   example: 401
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
router.post("/destroyRefreshToken", authenticate, destroyRefreshToken);

/**
 * @swagger
 * /api/auth/send-otp-mail:
 *   post:
 *     summary: Gửi OTP qua email
 *     description: |
 *       Gửi mã OTP đến email của người dùng để xác thực.
 *       Trường "type" phải thuộc danh sách hợp lệ (ví dụ: verify_email, reset_password).
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: "Email của người dùng"
 *                 example: "nguyenvana@example.com"
 *               type:
 *                 type: string
 *                 description: "Loại OTP (ví dụ: verify_email, reset_password)"
 *                 example: "verify_email"
 *     responses:
 *       200:
 *         description: "Gửi OTP thành công"
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
 *                   example: "OTP đã được gửi thành công."
 *       400:
 *         description: "Lỗi validate hoặc người dùng không tồn tại"
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
 *                   example: "Type không hợp lệ. Chỉ được: verify_email, reset_password"
 *       500:
 *         description: "Lỗi server khi gửi OTP thất bại"
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
 *                   example: "Gửi OTP thất bại, vui lòng thử lại"
 */
router.post("/send-otp-mail", sendOTPToEmailController);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Xác thực email bằng OTP
 *     description: |
 *       Người dùng nhập email và mã OTP đã được gửi để xác thực email.
 *       - Nếu đúng OTP và chưa hết hạn → email được xác thực.
 *       - Nếu sai nhiều lần vượt quá số lần cho phép → bị chặn xác thực.
 *       - Nếu OTP hết hạn → yêu cầu gửi lại OTP mới.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email của người dùng cần xác thực
 *                 example: "nguyenvana@example.com"
 *               code:
 *                 type: string
 *                 description: Mã OTP được gửi đến email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Xác thực email thành công
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
 *                   example: "Xác thực email thành công."
 *       400:
 *         description: Lỗi validate hoặc OTP không hợp lệ
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
 *                   examples:
 *                     otp_expired:
 *                       summary: OTP hết hạn
 *                       value: "OTP đã hết hạn"
 *                     otp_invalid:
 *                       summary: OTP sai
 *                       value: "OTP không đúng"
 *                     otp_attempts:
 *                       summary: Vượt quá số lần thử
 *                       value: "Bạn đã vượt quá số lần thử tối đa"
 *                     user_not_found:
 *                       summary: Email không tồn tại
 *                       value: "Người dùng không tồn tại"
 *       500:
 *         description: Lỗi server khi xác thực OTP
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
 */
router.post("/verify-email", verifyEmailController);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu
 *     description: Người dùng nhập email, mã OTP (loại `reset_password`) và mật khẩu mới để đặt lại mật khẩu.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nguyenvana@example.com"
 *               code:
 *                 type: string
 *                 description: Mã OTP gửi về email
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Mật khẩu mới (ít nhất 6 ký tự)
 *                 example: "newPassword123"
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
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
 *                   example: "Đổi mật khẩu thành công."
 *       400:
 *         description: Lỗi validate hoặc OTP không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post("/reset-password", resetPasswordController);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin cá nhân của tôi
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công.
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn.
 */
router.get("/me", authenticate, getMyProfile);

export default router;
