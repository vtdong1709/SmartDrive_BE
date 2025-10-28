import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import { getDriverWallet, createDriverWallet } from "../controllers/driverWalletController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: DriverWallet
 *     description: API quản lý ví tài xế
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DriverWallet:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         driver:
 *           type: string
 *           description: ID của tài xế
 *         balance:
 *           type: number
 *           description: Số dư khả dụng
 *         debt:
 *           type: number
 *           description: Nợ do hệ thống trừ hoa hồng
 *         totalEarnings:
 *           type: number
 *           description: Tổng thu nhập tích lũy
 *         totalWithdrawn:
 *           type: number
 *           description: Tổng tiền đã rút
 *         isLocked:
 *           type: boolean
 *           description: Trạng thái khóa ví
 *         lockReason:
 *           type: string
 *           nullable: true
 *           description: Lý do khóa ví
 *         bankAccount:
 *           type: object
 *           properties:
 *             numberBank:
 *               type: string
 *               description: Số tài khoản ngân hàng
 *             bankName:
 *               type: string
 *               description: Tên ngân hàng
 *         lastTopupRequest:
 *           type: object
 *           nullable: true
 *           properties:
 *             orderCode:
 *               type: number
 *             amount:
 *               type: number
 *             bank:
 *               type: object
 *               properties:
 *                 bankName:
 *                   type: string
 *                 accountNumber:
 *                   type: string
 *                 accountName:
 *                   type: string
 *             qrCode:
 *               type: string
 *             checkoutUrl:
 *               type: string
 *             description:
 *               type: string
 *             status:
 *               type: string
 *               enum: [pending, success, failed]
 *             createdAt:
 *               type: string
 *               format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           nullable: true
 */

/**
 * @swagger
 * /api/driver/wallet:
 *   post:
 *     summary: Tạo ví mới cho tài xế
 *     tags: [DriverWallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driverId, bankAccount]
 *             properties:
 *               driverId:
 *                 type: string
 *                 description: ID của tài xế
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               bankAccount:
 *                 type: object
 *                 required: [numberBank, bankName]
 *                 properties:
 *                   numberBank:
 *                     type: string
 *                     description: Số tài khoản ngân hàng
 *                     example: "1234567890"
 *                   bankName:
 *                     type: string
 *                     description: Tên ngân hàng
 *                     example: "Vietcombank"
 *     responses:
 *       201:
 *         description: Tạo ví thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverWallet'
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc ví đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Không tìm thấy tài xế
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post("/", authenticate, authorizeRoles("admin", "driver"), createDriverWallet);

/**
 * @swagger
 * /api/driver/wallet/{driverId}:
 *   get:
 *     summary: Lấy thông tin ví của tài xế
 *     tags: [DriverWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của tài xế
 *     responses:
 *       200:
 *         description: Lấy thông tin ví thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverWallet'
 *       404:
 *         description: Không tìm thấy ví hoặc tài xế
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get("/:driverId", authenticate, authorizeRoles("driver", "admin"), getDriverWallet);

export default router;
