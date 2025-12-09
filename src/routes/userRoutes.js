import express from "express";
import {
  authenticate,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";
import {
  deleteUser,
  getAllUsers,
  getUserDetails,
  updateUserByAdmin,
  updateUserProfile,
} from "../controllers/userController.js";
import { linkTelegramAccountFromBot } from "../controllers/telegramController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: API cho người dùng và quản lý người dùng (Admin)
 */

// ================== User Routes ==================

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               savedAddresses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     fullAddress:
 *                       type: string
 *                     location:
 *                       type: object
 *                       properties:
 *                         coordinates:
 *                           type: array
 *                           items:
 *                             type: number
 *               paymentMethods:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     provider:
 *                       type: string
 *                       enum: [momo, vnpay, paypal]
 *                     customerId:
 *                       type: string
 *                     isDefault:
 *                       type: boolean
 *             example:
 *               fullName: "Nguyễn Văn B"
 *               phone: "0987654322"
 *               avatar: "https://example.com/new-avatar.jpg"
 *               dateOfBirth: "1995-10-20"
 *               gender: "male"
 *               savedAddresses:
 *                 - name: "Nhà"
 *                   fullAddress: "123 Đường ABC, Phường 1, Quận 2, TP.HCM"
 *                   location:
 *                     coordinates: [106.7000, 10.7769]
 *                 - name: "Công ty"
 *                   fullAddress: "456 Đường XYZ, Phường 3, Quận 4, TP.HCM"
 *                   location:
 *                     coordinates: [106.7011, 10.7788]
 *               paymentMethods:
 *                 - provider: "momo"
 *                   customerId: "momo_customer_id_12345"
 *                   isDefault: true
 *     responses:
 *       '200':
 *         description: Cập nhật thành công
 *       '401':
 *         description: Unauthorized
 */
router.put("/profile", authenticate, updateUserProfile);

/**
 * @swagger
 * /api/users/link-telegram:
 *   post:
 *     summary: Liên kết tài khoản Telegram từ bot
 *     tags: [Users]
 *     description: Endpoint này được bot Telegram gọi khi user bắt đầu chat với bot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - telegramId
 *               - chatId
 *             properties:
 *               telegramId:
 *                 type: string
 *                 description: Telegram user ID
 *                 example: "123456789"
 *               chatId:
 *                 type: string
 *                 description: Telegram chat ID
 *                 example: "123456789"
 *               username:
 *                 type: string
 *                 description: Telegram username (optional)
 *                 example: "smartdrive_user"
 *               userId:
 *                 type: string
 *                 description: MongoDB user ID (optional, nếu có sẽ link trực tiếp)
 *                 example: "65a1bcde1234567890abcd12"
 *     responses:
 *       200:
 *         description: Liên kết thành công
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.post("/link-telegram", linkTelegramAccountFromBot);

// ================== Admin Routes ==================

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: (Admin) Lấy danh sách tất cả người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Thành công
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (Không có quyền truy cập)
 */
router.get("/", authenticate, authorizeRoles("admin"), getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: (Admin) Lấy chi tiết một người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       '200':
 *         description: Thành công
 *       '404':
 *         description: Không tìm thấy người dùng
 */
router.get("/:id", authenticate, authorizeRoles("admin", "driver","renter"), getUserDetails);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: (Admin) Cập nhật thông tin người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [renter, staff, admin]
 *               verified:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Cập nhật thành công
 *       '404':
 *         description: Không tìm thấy người dùng
 */
router.put("/:id", authenticate, authorizeRoles("admin"), updateUserByAdmin);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: (Admin) Xóa người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       '200':
 *         description: Xóa thành công
 *       '404':
 *         description: Không tìm thấy người dùng
 */
router.get("/:id", authenticate, authorizeRoles("admin", "driver"), getUserDetails);
router.put("/:id", authenticate, authorizeRoles("admin"), updateUserByAdmin);
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteUser);

export default router;


