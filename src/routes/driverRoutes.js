import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import { countOnlineDrivers, listOnlineDrivers, setMyAvailability, toggleAvailability } from "../controllers/driverController.js";
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

// /**
//  * @swagger
//  * /api/driver/me/availability:
//  *   patch:
//  *     summary: Bật/tắt trạng thái sẵn sàng nhận cuốc (chỉ tài xế đã duyệt)
//  *     tags: [Driver]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/AvailabilityRequest'
//  *     responses:
//  *       200:
//  *         description: Cập nhật thành công
//  *         content:
//  *           application/json:
//  *             schema:
//  *               allOf:
//  *                 - $ref: '#/components/schemas/ApiResponse'
//  *                 - type: object
//  *                   properties:
//  *                     data:
//  *                       $ref: '#/components/schemas/DriverProfile'
//  */
// router.patch("/me/availability", authenticate, authorizeRoles("driver"), validateAvailability, setMyAvailability);


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
router.patch(
    "/me/availability",
    authenticate,
    authorizeRoles("driver"),
    validateAvailability,
    toggleAvailability
  );
/**
 * @swagger
 * /api/driver/online/count:
 *   get:
 *     summary: Lấy số lượng tài xế đang online (real-time)
 *     tags: [Driver]
 *     responses:
 *       200:
 *         description: Số lượng tài xế online hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 */
router.get("/online/count", countOnlineDrivers);

/**
 * @swagger
 * /api/driver/online/list:
 *   get:
 *     summary: Lấy danh sách tài xế đang online (real-time)
 *     tags: [Driver]
 *     responses:
 *       200:
 *         description: Danh sách tài xế online và vị trí
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 drivers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       driverId:
 *                         type: string
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                       lastSeen:
 *                         type: string
 */
router.get("/online/list", listOnlineDrivers);

export default router;