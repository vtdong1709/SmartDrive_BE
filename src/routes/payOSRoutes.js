import express from "express";
import {
  createPaymentLinkController,
  payOSWebhookController,
} from "../controllers/payOSController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: PayOS
 *     description: Các API liên quan đến thanh toán PayOS
 */

/**
 * @swagger
 * /api/payos/create-payment:
 *   post:
 *     tags:
 *       - PayOS
 *     summary: Tạo link thanh toán PayOS
 *     description: >
 *       API này tạo link thanh toán qua PayOS cho hai mục đích:
 *       - **booking**: Khách hàng thanh toán cho chuyến đi (sử dụng `bookingCode` làm `referenceId`)
 *       - **wallet_topup**: Tài xế nạp tiền vào ví (sử dụng `_id` của `DriverWallet` làm `referenceId`)
 *
 *       Hệ thống sẽ sinh `orderCode` ngẫu nhiên, gọi PayOS API để tạo link thanh toán,
 *       rồi lưu thông tin thanh toán (bank info, qrCode, checkoutUrl, ...) vào DB.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purpose
 *               - referenceId
 *             properties:
 *               purpose:
 *                 type: string
 *                 enum:
 *                   - booking
 *                   - wallet_topup
 *                 description: |
 *                   Loại mục đích thanh toán:
 *                   - `booking`: thanh toán cho chuyến đi
 *                   - `wallet_topup`: nạp tiền vào ví tài xế
 *                 example: booking
 *               referenceId:
 *                 type: string
 *                 description: |
 *                   Mã tham chiếu:
 *                   - Nếu `purpose = booking`: truyền `bookingCode`
 *                   - Nếu `purpose = wallet_topup`: truyền `_id` của ví tài xế (`DriverWallet`)
 *                 example: BK20251028001
 *               amount:
 *                 type: number
 *                 description: >
 *                   Số tiền thanh toán.
 *                   - Bắt buộc khi `purpose = wallet_topup`
 *                   - Với `booking`, hệ thống sẽ tự lấy `totalAmount` hoặc `price` từ `Booking`.
 *                 example: 150000
 *     responses:
 *       200:
 *         description: Tạo link thanh toán thành công
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
 *                   example: Tạo link thanh toán thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderCode:
 *                       type: number
 *                       description: Mã đơn hàng sinh ngẫu nhiên (duy nhất)
 *                       example: 1730093245123
 *                     amount:
 *                       type: number
 *                       example: 150000
 *                     bank:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         bankName:
 *                           type: string
 *                           example: MBBank
 *                         accountNumber:
 *                           type: string
 *                           example: "9704221234567890"
 *                         accountName:
 *                           type: string
 *                           example: "CONG TY TNHH PAYOS"
 *                     qrCode:
 *                       type: string
 *                       description: Base64 hoặc URL mã QR thanh toán
 *                       example: "https://payos.vn/qrcode/123456.png"
 *                     checkoutUrl:
 *                       type: string
 *                       description: URL trang thanh toán của PayOS
 *                       example: "https://pay.payos.vn/checkout/abcd1234"
 *                     description:
 *                       type: string
 *                       example: "Thanh toán chuyến đi #BK20251028001"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-28T10:20:30.000Z"
 *                     provider:
 *                       type: string
 *                       example: payos
 *       400:
 *         description: Thiếu thông tin bắt buộc
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
 *                   example: "Thiếu thông tin bắt buộc: purpose hoặc referenceId"
 *                 code:
 *                   type: number
 *                   example: 400
 *       500:
 *         description: Lỗi server hoặc lỗi từ PayOS
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
 *                   example: "Không thể tạo link thanh toán, vui lòng thử lại sau."
 *                 code:
 *                   type: number
 *                   example: 500
 */
router.post("/create-payment", createPaymentLinkController);

router.post("/webhook", payOSWebhookController);

export default router;
