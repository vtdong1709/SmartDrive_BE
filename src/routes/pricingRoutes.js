import express from "express";
import { createPricing, 
    deletePricing,
     getAllPricing, 
     getPricingById, 
     updatePricing }
      from "../controllers/pricingController.js";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Pricing
 *   description: Quản lý bảng giá dịch vụ thuê tài xế (ADMIN)
 */
    

/**
 * @swagger
 * /api/pricing/create:
 *   post:
 *     summary: Tạo bảng giá dịch vụ
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceType
 *             properties:
 *               serviceType:
 *                 type: string
 *                 enum: [per_km, hourly, daily, intercity]
 *               baseFare:
 *                 type: number
 *               fareBrackets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     from:
 *                       type: number
 *                     to:
 *                       type: number
 *                     pricePerKm:
 *                       type: number
 *               hourBrackets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fromHour:
 *                       type: number
 *                     toHour:
 *                       type: number
 *                     pricePerHour:
 *                       type: number
 *               dayBrackets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fromDay:
 *                       type: number
 *                     toDay:
 *                       type: number
 *                     pricePerDay:
 *                       type: number
 *               multipliers:
 *                 type: object
 *                 properties:
 *                   after21h: { type: number, example: 1.08 }
 *                   after23h: { type: number, example: 1.12 }
 *                   weekend: { type: number, example: 1.10 }
 *                   holiday: { type: number, example: 1.15 }
 *               waitingFeePerMin:
 *                 type: number
 *               platformFee:
 *                 type: number
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *           examples:
 *             per_km:
 *               summary: Tính giá theo km
 *               value:
 *                 serviceType: "per_km"
 *                 baseFare: 50000
 *                 fareBrackets:
 *                   - { from: 0, to: 10, pricePerKm: 13000 }
 *                   - { from: 11, to: 20, pricePerKm: 10000 }
 *                   - { from: 21, to: null, pricePerKm: 8000 }
 *                 multipliers:
 *                   after21h: 1.08
 *                   after23h: 1.12
 *                   weekend: 1.10
 *                   holiday: 1.15
 *                 waitingFeePerMin: 2000
 *                 platformFee: 30000
 *                 effectiveFrom: "2025-01-01T00:00:00Z"
 *                 effectiveTo: "2025-12-31T23:59:59Z"
 *
 *             hourly:
 *               summary: Tính giá theo giờ (4 tiếng và 8 tiếng tối đa)
 *               value:
 *                 serviceType: "hourly"
 *                 baseFare: 100000
 *                 hourBrackets:
 *                   - { fromHour: 1, toHour: 4, pricePerHour: 50000 }
 *                   - { fromHour: 5, toHour: 8, pricePerHour: 40000 }
 *                 multipliers:
 *                   after21h: 1.08
 *                   after23h: 1.12
 *                   weekend: 1.10
 *                   holiday: 1.15
 *                 waitingFeePerMin: 2000
 *                 platformFee: 30000
 *                 effectiveFrom: "2025-01-01T00:00:00Z"
 *                 effectiveTo: "2025-12-31T23:59:59Z"
 *
 *             daily:
 *               summary: Tính giá theo ngày (1–3 ngày)
 *               value:
 *                 serviceType: "daily"
 *                 baseFare: 300000
 *                 dayBrackets:
 *                   - { fromDay: 1, toDay: 1, pricePerDay: 300000 }
 *                   - { fromDay: 2, toDay: 2, pricePerDay: 270000 }
 *                   - { fromDay: 3, toDay: 3, pricePerDay: 250000 }
 *                 multipliers:
 *                   after21h: 1.08
 *                   after23h: 1.12
 *                   weekend: 1.10
 *                   holiday: 1.15
 *                 waitingFeePerMin: 2000
 *                 platformFee: 30000
 *                 effectiveFrom: "2025-01-01T00:00:00Z"
 *                 effectiveTo: "2025-12-31T23:59:59Z"
 *
 *             intercity:
 *               summary: Tính giá liên tỉnh (70km đầu, 71–100km, >100km)
 *               value:
 *                 serviceType: "intercity"
 *                 baseFare: 150000
 *                 fareBrackets:
 *                   - { from: 0, to: 70, pricePerKm: 10000 }
 *                   - { from: 71, to: 100, pricePerKm: 9000 }
 *                   - { from: 101, to: null, pricePerKm: 8000 }
 *                 multipliers:
 *                   after21h: 1.08
 *                   after23h: 1.12
 *                   weekend: 1.10
 *                   holiday: 1.15
 *                 waitingFeePerMin: 2000
 *                 platformFee: 30000
 *                 effectiveFrom: "2025-01-01T00:00:00Z"
 *                 effectiveTo: "2025-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Pricing created successfully
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
 *                   example: "Pricing created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Pricing'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

router.post("/create", authenticate, authorizeRoles("admin"), createPricing);

/**
 * @swagger
 * /api/pricing/getAll:
 *   get:
 *     summary: Lấy tất cả bảng giá.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: number
 *         description: Page number
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: number
 *         description: Limit number
 *     responses:
 *       200:
 *         description: Pricing fetched successfully
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/getAll",authenticate, getAllPricing);        // Lấy tất cả bảng giá

/**
 * @swagger
 * /api/pricing/getById/{id}:
 *   get:
 *     summary: Lấy chi tiết theo ID.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pricing ID
 *     responses:
 *       200:
 *         description: Pricing fetched successfully
 *       404:
 *         description: Pricing not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/getById/:id",authenticate, getPricingById);    // Lấy chi tiết theo ID

/**
 * @swagger
 * /api/pricing/update/{id}:
 *   put:
 *     summary: Cập nhật bảng giá.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pricing ID
 *     responses:
 *       200:
 *         description: Pricing updated successfully
 *       404:
 *         description: Pricing not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put("/update/:id",authenticate, authorizeRoles("admin"), updatePricing);     // Cập nhật

/**
 * @swagger
 * /api/pricing/delete/{id}:
 *   delete:
 *     summary: Xóa bảng giá.
 *     tags: [Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pricing ID
 *     responses:
 *       200:
 *         description: Pricing deleted successfully
 *       404:
 *         description: Pricing not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete("/delete/:id",authenticate, authorizeRoles("admin"), deletePricing);  // Xóa

export default router;