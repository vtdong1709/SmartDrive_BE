import express from "express";
import { authenticate, authorizeRoles } from "../../middlewares/authMiddleware.js";
import * as c from "../controllers/pricingEngineController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: PricingEngine
 *     description: Pricing Engine dùng chung (không áp dụng Xe ghép)
 */

/**
 * @swagger
 * /api/pricing/quote:
 *   post:
 *     tags: [PricingEngine]
 *     summary: Tạo quote server-side
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service]
 *             properties:
 *               service:
 *                 type: string
 *                 enum: [DRIVER_BOOKING, RIDE_HAILING, SELF_DRIVE, DELIVERY, ROADSIDE_ASSISTANCE, PARKING]
 *               context:
 *                 type: object
 */
router.post("/quote", authenticate, c.quote);

/**
 * @swagger
 * /api/pricing/plans:
 *   get:
 *     tags: [PricingEngine]
 *     summary: Danh sách PricingPlan (versioned)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [PricingEngine]
 *     summary: Tạo version bảng giá mới (không sửa version đang active)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/plans", authenticate, authorizeRoles("admin", "staff"), c.listPlans);
router.post("/plans", authenticate, authorizeRoles("admin", "staff"), c.createPlan);
router.post("/commissions", authenticate, authorizeRoles("admin", "staff"), c.createCommission);

export default router;
