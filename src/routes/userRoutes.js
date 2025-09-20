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
 *                 description: Họ và tên mới
 *                 example: "Nguyễn Văn B"
 *               phone:
 *                 type: string
 *                 description: Số điện thoại mới
 *                 example: "0987654321"
 *               avatar:
 *                 type: string
 *                 description: URL ảnh đại diện mới
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       '200':
 *         description: Cập nhật thành công
 *       '401':
 *         description: Unauthorized
 */
router.put("/profile", authenticate, updateUserProfile);

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
router.get("/:id", authenticate, authorizeRoles("admin"), getUserDetails);

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
 *               avatar:
 *                 type: string
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
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteUser);

export default router;