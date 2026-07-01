import express from "express";
import {
  createVNPayPaymentController,
  vnpayIPNController,
  vnpayReturnController,
} from "../controllers/vnpayController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: VNPay
 *     description: Các API liên quan đến thanh toán VNPay Sandbox
 */

/**
 * @swagger
 * /api/vnpay/create-payment:
 *   post:
 *     tags:
 *       - VNPay
 *     summary: Tạo link thanh toán VNPay
 *     description: >
 *       API tạo URL thanh toán VNPay Sandbox cho hai mục đích:
 *       - **booking**: Khách thanh toán chuyến đi (`referenceId` = `bookingCode`)
 *       - **wallet_topup**: Tài xế nạp ví (`referenceId` = `_id` của `DriverWallet`, bắt buộc có `amount`)
 *
 *       Hệ thống sinh `orderCode` (vnp_TxnRef), lưu vào DB và trả `checkoutUrl` để mở cổng VNPay.
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
 *                 example: booking
 *               referenceId:
 *                 type: string
 *                 description: bookingCode hoặc _id ví tài xế
 *                 example: BK2510040001
 *               amount:
 *                 type: number
 *                 description: Bắt buộc khi purpose = wallet_topup
 *                 example: 150000
 *     responses:
 *       200:
 *         description: Tạo link thanh toán VNPay thành công
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
 *                   example: Tạo link thanh toán VNPay thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderCode:
 *                       type: number
 *                       example: 1730093245123
 *                     amount:
 *                       type: number
 *                       example: 150000
 *                     checkoutUrl:
 *                       type: string
 *                       description: URL redirect sang cổng VNPay Sandbox
 *                       example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
 *                     description:
 *                       type: string
 *                       example: "booking:BK2510040001"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Thiếu thông tin hoặc dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy booking hoặc ví
 *       500:
 *         description: Lỗi server hoặc thiếu cấu hình VNPay
 */
router.post("/create-payment", createVNPayPaymentController);

/**
 * @swagger
 * /api/vnpay/ipn:
 *   get:
 *     tags:
 *       - VNPay
 *     summary: IPN callback từ VNPay
 *     description: >
 *       Endpoint VNPay gọi server-to-server sau khi thanh toán.
 *       Không gọi thủ công từ app; cần cấu hình IPN URL trên merchant VNPay trỏ tới route này.
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: Mã giao dịch (orderCode)
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         description: Số tiền (đơn vị x100 VND)
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: Mã 00 là thanh toán thành công
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         description: Chữ ký xác thực từ VNPay
 *     responses:
 *       200:
 *         description: Phản hồi theo chuẩn VNPay
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "00"
 *                 Message:
 *                   type: string
 *                   example: Confirm Success
 */
router.get("/ipn", vnpayIPNController);

/**
 * @swagger
 * /api/vnpay/return:
 *   get:
 *     tags:
 *       - VNPay
 *     summary: Return URL sau khi khách thanh toán
 *     description: >
 *       VNPay redirect người dùng về URL này (cấu hình `VNP_RETURN_URL`).
 *       Hệ thống xác minh chữ ký, cập nhật booking/ví và redirect về app (Expo deep link).
 *     parameters:
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect về app khi xử lý thành công
 *       200:
 *         description: JSON khi không có redirectUrl
 *       400:
 *         description: Chữ ký không hợp lệ
 *       404:
 *         description: Không tìm thấy giao dịch tương ứng
 */
router.get("/return", vnpayReturnController);

export default router;
