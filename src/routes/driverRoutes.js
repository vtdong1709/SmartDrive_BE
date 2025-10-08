import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import { setMyAvailability } from "../controllers/driverController.js";
import { validateAvailability } from "../middlewares/validateDriver.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Driver
 *     description: API chỉ dành cho tài xế đã được duyệt
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DriverProfile:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         approved:
 *           type: boolean
 *         availability:
 *           type: string
 *           enum: [online, offline]
 *     AvailabilityRequest:
 *       type: object
 *       required: [online]
 *       properties:
 *         online:
 *           type: boolean
 *           example: true
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
 * /api/driver/me/availability:
 *   patch:
 *     summary: Bật/tắt trạng thái sẵn sàng nhận cuốc (chỉ tài xế đã duyệt)
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AvailabilityRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverProfile'
 */
router.patch("/me/availability", authenticate, authorizeRoles("driver"), validateAvailability, setMyAvailability);

export default router;