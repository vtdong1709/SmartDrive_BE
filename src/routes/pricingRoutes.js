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
    

// /**
//  * @swagger
//  * /api/pricing/create:
//  *   post:
//  *     summary: Tạo bảng giá
//  *     tags: [Pricing]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - serviceType
//  *               - baseFare
//  *               - perKm
//  *             properties:
//  *               serviceType:
//  *                 type: string
//  *                 enum: [hourly, daily, airport_transfer]
//  *               baseFare:
//  *                 type: number
//  *               perKm:
//  *                 type: number
//  *               perHour:
//  *                 type: number
//  *               perDay:
//  *                 type: number
//  *               waitingFeePerMin:
//  *                 type: number
//  *               multipliers:
//  *                 type: object
//  *                 properties:
//  *                   night:
//  *                     type: number
//  *                   weekend:
//  *                     type: number
//  *                   holiday:
//  *                     type: number
//  *               effectiveFrom:
//  *                 type: string
//  *                 format: date-time
//  *               effectiveTo:
//  *                 type: string
//  *                 format: date-time
//  *     responses:
//  *       200:
//  *         description: Pricing created successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                   example: true
//  *                 message:
//  *                   type: string
//  *                   example: "Pricing created successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/Pricing'
//  *       404:
//  *         description: Pricing not found
//  *       400:
//  *         description: Bad request
//  *       500:
//  *         description: Internal server error
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  */
// router.post("/create",authenticate, authorizeRoles("admin"), createPricing);       // Tạo bảng giá

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
 *                 example: 50000
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
 *               turnBackFees:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fromKm:
 *                       type: number
 *                     toKm:
 *                       type: number
 *                     fee:
 *                       type: number
 *               waitingFeePerMin:
 *                 type: number
 *                 example: 2000
 *               multipliers:
 *                 type: object
 *                 properties:
 *                   after21h:
 *                     type: number
 *                     example: 1.08
 *                   after23h:
 *                     type: number
 *                     example: 1.12
 *                   weekend:
 *                     type: number
 *                     example: 1.10
 *                   holiday:
 *                     type: number
 *                     example: 1.15
 *               maxKmPerHour:
 *                 type: number
 *                 example: 25
 *               maxKmPerDay:
 *                 type: number
 *                 example: 100
 *               surchargePerKm:
 *                 type: number
 *                 example: 5000
 *               platformFee:
 *                 type: number
 *                 example: 30000
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *           example:
 *             serviceType: "per_km"
 *             baseFare: 50000
 *             fareBrackets:
 *               - { from: 0, to: 10, pricePerKm: 13000 }
 *               - { from: 11, to: 20, pricePerKm: 10000 }
 *               - { from: 21, to: null, pricePerKm: 8000 }
 *             multipliers:
 *               after21h: 1.08
 *               after23h: 1.12
 *               weekend: 1.10
 *               holiday: 1.15
 *             waitingFeePerMin: 2000
 *             platformFee: 30000
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