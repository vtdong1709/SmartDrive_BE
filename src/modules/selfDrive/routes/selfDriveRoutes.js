import express from "express";
import { authenticate, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import * as c from "../controllers/selfDriveController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: SelfDrive
 *     description: Thuê xe tự lái (độc lập Driver Rental / Shared Ride)
 */

/**
 * @swagger
 * /api/self-drive/vehicles:
 *   post:
 *     tags: [SelfDrive]
 *     summary: Chủ xe tạo xe (draft)
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [SelfDrive]
 *     summary: Danh sách xe của tôi
 *     security: [{ bearerAuth: [] }]
 */
router.post("/vehicles", authenticate, c.createVehicle);
router.get("/vehicles", authenticate, c.listMyVehicles);

/**
 * @swagger
 * /api/self-drive/search:
 *   get:
 *     tags: [SelfDrive]
 *     summary: Tìm xe còn trống theo interval
 *     parameters:
 *       - in: query
 *         name: startAt
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endAt
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *       - in: query
 *         name: seatCount
 *         schema: { type: integer }
 *       - in: query
 *         name: bodyType
 *         schema: { type: string }
 *       - in: query
 *         name: transmission
 *         schema: { type: string }
 *       - in: query
 *         name: fuelType
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: delivery
 *         schema: { type: boolean }
 *       - in: query
 *         name: instantBooking
 *         schema: { type: boolean }
 */
router.get("/search", c.searchVehicles);

/**
 * @swagger
 * /api/self-drive/vehicles/{vehicleId}/quote:
 *   post:
 *     tags: [SelfDrive]
 *     summary: Báo giá server-side (không tin giá FE)
 * /api/self-drive/bookings/{bookingId}/pay:
 *   post:
 *     tags: [SelfDrive]
 *     summary: Thanh toán thuê xe hoặc cọc (purpose deposit)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/vehicles/:vehicleId/public", c.getPublicVehicle);
router.get("/vehicles/:vehicleId/availability/public", c.publicAvailability);
router.post("/vehicles/:vehicleId/quote", c.quoteVehicle);

router.get("/vehicles/:vehicleId", authenticate, c.getMyVehicle);
router.patch("/vehicles/:vehicleId", authenticate, c.updateVehicle);
router.post("/vehicles/:vehicleId/publish", authenticate, c.publishVehicle);
router.post("/vehicles/:vehicleId/photos", authenticate, c.uploadPhotosMw, c.uploadVehiclePhotos);
router.post("/vehicles/:vehicleId/photos/url", authenticate, c.addPhotoUrl);
router.delete("/vehicles/:vehicleId/photos/:photoId", authenticate, c.removePhoto);
router.get("/vehicles/:vehicleId/availability", authenticate, c.listAvailability);
router.post("/vehicles/:vehicleId/availability", authenticate, c.addAvailability);
router.delete("/vehicles/:vehicleId/availability/:availabilityId", authenticate, c.removeAvailability);

router.get("/owner/bookings", authenticate, c.ownerBookings);
router.post("/owner/bookings/:bookingId/respond", authenticate, c.respondBooking);
router.post("/owner/bookings/:bookingId/ready", authenticate, c.markReady);
router.post("/owner/bookings/:bookingId/return", authenticate, c.returnInspect);

/**
 * @swagger
 * /api/self-drive/bookings:
 *   post:
 *     tags: [SelfDrive]
 *     summary: Tạo booking (quote server-side)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicleId, startAt, endAt]
 *             properties:
 *               vehicleId: { type: string }
 *               startAt: { type: string, format: date-time }
 *               endAt: { type: string, format: date-time }
 *               deliveryLocation:
 *                 type: object
 *                 properties:
 *                   address: { type: string }
 *                   lat: { type: number }
 *                   lng: { type: number }
 */
router.post("/bookings", authenticate, authorizeRoles("renter", "driver", "admin"), c.createBooking);
router.get("/bookings/me", authenticate, c.myRentals);
router.get("/bookings/:bookingId", authenticate, c.getBooking);
router.post("/bookings/:bookingId/cancel", authenticate, c.cancelBooking);
router.post("/bookings/:bookingId/pay", authenticate, c.payBooking);
router.get("/bookings/:bookingId/deposit", authenticate, c.getDeposit);
router.post("/bookings/:bookingId/handover", authenticate, c.handover);
router.get("/bookings/:bookingId/handover", authenticate, c.getHandover);
router.post("/bookings/:bookingId/return/confirm", authenticate, c.confirmReturn);
router.get("/bookings/:bookingId/return", authenticate, c.getReturn);

router.get("/admin/bookings", authenticate, authorizeRoles("admin", "staff"), c.adminListBookings);

export default router;
