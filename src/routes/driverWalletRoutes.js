import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import { getDriverWallet, createDriverWallet, updateDriverWallet, getDriverTransactions } from "../controllers/driverWalletController.js";

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
 * /api/driver/wallet/{driverId}/transactions/{type}:
 *   get:
 *     summary: Lấy danh sách giao dịch của tài xế theo loại
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
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [booking_income, withdraw]
 *         description: Loại giao dịch (booking_income hoặc withdraw)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng giao dịch mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách giao dịch thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         transactions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               driver:
 *                                 type: string
 *                               wallet:
 *                                 type: string
 *                               booking:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   _id:
 *                                     type: string
 *                                   bookingCode:
 *                                     type: string
 *                                   startAddress:
 *                                     type: string
 *                                   endAddress:
 *                                     type: string
 *                                   distance:
 *                                     type: number
 *                                   duration:
 *                                     type: number
 *                                   price:
 *                                     type: number
 *                               withdrawRequest:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   _id:
 *                                     type: string
 *                                   amount:
 *                                     type: number
 *                                   status:
 *                                     type: string
 *                                   createdAt:
 *                                     type: string
 *                               type:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               balanceBefore:
 *                                 type: number
 *                               balanceAfter:
 *                                 type: number
 *                               note:
 *                                 type: string
 *                                 nullable: true
 *                               createdAt:
 *                                 type: string
 *                               updatedAt:
 *                                 type: string
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             page:
 *                               type: integer
 *                             limit:
 *                               type: integer
 *                             totalPages:
 *                               type: integer
 *       400:
 *         description: Dữ liệu không hợp lệ
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
router.get("/:driverId/transactions/:type", authenticate, authorizeRoles("driver", "admin"), getDriverTransactions);

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

/**
 * @swagger
 * /api/driver/wallet/{driverId}:
 *   put:
 *     summary: Cập nhật thông tin tài khoản ngân hàng
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankAccount]
 *             properties:
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
 *       200:
 *         description: Cập nhật thông tin tài khoản ngân hàng thành công
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
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
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
router.put("/:driverId", authenticate, authorizeRoles("driver", "admin"), updateDriverWallet);

export default router;
