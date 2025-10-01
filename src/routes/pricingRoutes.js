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
 *     summary: Tạo bảng giá
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
 *               - baseFare
 *               - perKm
 *             properties:
 *               serviceType:
 *                 type: string
 *                 enum: [hourly, daily, airport_transfer]
 *               baseFare:
 *                 type: number
 *               perKm:
 *                 type: number
 *               perHour:
 *                 type: number
 *               perDay:
 *                 type: number
 *               waitingFeePerMin:
 *                 type: number
 *               multipliers:
 *                 type: object
 *                 properties:
 *                   night:
 *                     type: number
 *                   weekend:
 *                     type: number
 *                   holiday:
 *                     type: number
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
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
 */
router.post("/create",authenticate, authorizeRoles("admin"), createPricing);       // Tạo bảng giá

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