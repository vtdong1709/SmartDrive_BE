import express from "express";
import { authenticate, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import * as c from "../controllers/sharedRideController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: SharedRides
 *     description: Module xe ghép / shared ride (độc lập với thuê tài xế lái hộ)
 */

/**
 * @swagger
 * /api/shared-rides/seat-templates:
 *   get:
 *     tags: [SharedRides]
 *     summary: Danh sách seat layout theo loại xe (4/5/7/9/16)
 *     responses:
 *       200:
 *         description: OK
 */
router.get("/seat-templates", c.listSeatTemplates);

/**
 * @swagger
 * /api/shared-rides/vehicles:
 *   post:
 *     tags: [SharedRides]
 *     summary: Tài xế tạo xe + seat layout
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, plate, vehicleType]
 *             properties:
 *               name: { type: string, example: Toyota Fortuner }
 *               plate: { type: string, example: 51A-123.45 }
 *               vehicleType: { type: string, enum: ["4","5","7","9","16"] }
 *               color: { type: string }
 *               charterEnabled: { type: boolean }
 *               charterWindows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     start: { type: string, example: "18:00" }
 *                     end: { type: string, example: "23:00" }
 *     responses:
 *       200: { description: Created }
 *   get:
 *     tags: [SharedRides]
 *     summary: Danh sách xe của tài xế
 *     security: [{ bearerAuth: [] }]
 */
router.post("/vehicles", authenticate, authorizeRoles("driver", "admin"), c.createVehicle);
router.get("/vehicles", authenticate, authorizeRoles("driver", "admin"), c.listMyVehicles);
router.get("/vehicles/:vehicleId", authenticate, authorizeRoles("driver", "admin"), c.getVehicle);
router.patch("/vehicles/:vehicleId", authenticate, authorizeRoles("driver", "admin"), c.updateVehicle);
router.patch("/vehicles/:vehicleId/seats", authenticate, authorizeRoles("driver", "admin"), c.configureVehicleSeats);

/**
 * @swagger
 * /api/shared-rides/trips:
 *   post:
 *     tags: [SharedRides]
 *     summary: Tạo chuyến nháp
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [origin, destination, departureAt, vehicleId]
 *             properties:
 *               vehicleId: { type: string }
 *               departureAt: { type: string, format: date-time }
 *               origin:
 *                 type: object
 *                 properties:
 *                   address: { type: string }
 *                   lat: { type: number }
 *                   lng: { type: number }
 *               destination:
 *                 type: object
 *                 properties:
 *                   address: { type: string }
 *                   lat: { type: number }
 *                   lng: { type: number }
 *               waypoints:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     address: { type: string }
 *                     lat: { type: number }
 *                     lng: { type: number }
 *               allowSeatBooking: { type: boolean }
 *               allowCharter: { type: boolean }
 *               pricingMode: { type: string, enum: [FIXED_TRIP, DISTANCE_BASED, SEGMENT_BASED] }
 *               baseSeatPrice: { type: number, example: 150000 }
 *               charterPrice: { type: number, example: 1200000 }
 *               maxPickupDeviationKm: { type: number, example: 2 }
 *               maxDropoffDeviationKm: { type: number, example: 2 }
 *   get:
 *     tags: [SharedRides]
 *     summary: Danh sách chuyến của tài xế
 *     security: [{ bearerAuth: [] }]
 */
router.post("/trips", authenticate, authorizeRoles("driver", "admin"), c.createDraftTrip);
router.get("/trips", authenticate, authorizeRoles("driver", "admin"), c.listDriverTrips);

/**
 * @swagger
 * /api/shared-rides/trips/{tripId}:
 *   get:
 *     tags: [SharedRides]
 *     summary: Chi tiết chuyến (public)
 *   patch:
 *     tags: [SharedRides]
 *     summary: Tài xế cập nhật chuyến / route / pricing
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/publish:
 *   post:
 *     tags: [SharedRides]
 *     summary: Đăng chuyến (DRAFT → OPEN)
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/dashboard:
 *   get:
 *     tags: [SharedRides]
 *     summary: Dashboard chuyến cho tài xế
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/manifest:
 *   get:
 *     tags: [SharedRides]
 *     summary: Manifest khách theo thứ tự đón
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/start:
 *   post:
 *     tags: [SharedRides]
 *     summary: Bắt đầu chuyến
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/complete:
 *   post:
 *     tags: [SharedRides]
 *     summary: Hoàn thành chuyến
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/cancel:
 *   post:
 *     tags: [SharedRides]
 *     summary: Hủy chuyến
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/trips/{tripId}/holds:
 *   post:
 *     tags: [SharedRides]
 *     summary: Giữ ghế tạm (mặc định 10 phút)
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/holds/{holdId}:
 *   delete:
 *     tags: [SharedRides]
 *     summary: Hủy hold ghế
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/bookings/{bookingId}:
 *   get:
 *     tags: [SharedRides]
 *     summary: Chi tiết booking
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/bookings/{bookingId}/pay:
 *   post:
 *     tags: [SharedRides]
 *     summary: Tạo link thanh toán VNPay/PayOS
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider: { type: string, enum: [vnpay, payos] }
 * /api/shared-rides/charters:
 *   post:
 *     tags: [SharedRides]
 *     summary: Tạo yêu cầu bao xe
 *     security: [{ bearerAuth: [] }]
 * /api/shared-rides/charters/quote:
 *   post:
 *     tags: [SharedRides]
 *     summary: Báo giá bao xe
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/trips/:tripId", authenticate, authorizeRoles("driver", "admin"), c.updateTrip);
router.patch("/trips/:tripId/seats", authenticate, authorizeRoles("driver", "admin"), c.configureTripSeats);
router.post("/trips/:tripId/publish", authenticate, authorizeRoles("driver", "admin"), c.publishTrip);
router.get("/trips/:tripId/dashboard", authenticate, authorizeRoles("driver", "admin"), c.tripDashboard);
router.get("/trips/:tripId/passengers", authenticate, authorizeRoles("driver", "admin"), c.tripPassengers);
router.get("/trips/:tripId/manifest", authenticate, authorizeRoles("driver", "admin"), c.tripManifest);
router.post("/trips/:tripId/start", authenticate, authorizeRoles("driver", "admin"), c.startTrip);
router.post("/trips/:tripId/complete", authenticate, authorizeRoles("driver", "admin"), c.completeTrip);
router.post("/trips/:tripId/cancel", authenticate, authorizeRoles("driver", "admin"), c.cancelTrip);
router.get("/driver/revenue", authenticate, authorizeRoles("driver", "admin"), c.driverRevenue);
router.post("/driver/bookings/:bookingId/cancel", authenticate, authorizeRoles("driver", "admin"), c.driverCancelBooking);
router.get("/driver/charters", authenticate, authorizeRoles("driver", "admin"), c.listDriverCharters);
router.post("/driver/charters/:charterId/respond", authenticate, authorizeRoles("driver", "admin"), c.respondCharter);

/**
 * @swagger
 * /api/shared-rides/search:
 *   get:
 *     tags: [SharedRides]
 *     summary: Tìm chuyến theo trùng lộ trình (không so khớp origin/destination cứng)
 *     parameters:
 *       - in: query
 *         name: pickupLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: pickupLng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: dropoffLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: dropoffLng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: passengerCount
 *         schema: { type: integer, default: 1 }
 */
router.get("/search", c.searchTrips);
router.get("/popular-routes", c.popularRoutes);
router.get("/charter-drivers", c.listCharterDrivers);
router.get("/trips/:tripId", c.getTripDetail);

/**
 * @swagger
 * /api/shared-rides/trips/{tripId}/seats:
 *   get:
 *     tags: [SharedRides]
 *     summary: Seat map theo segment pickup/dropoff của khách
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: pickupLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: pickupLng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: dropoffLat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: dropoffLng
 *         required: true
 *         schema: { type: number }
 */
router.get("/trips/:tripId/seats", c.getSeatMap);
router.get("/trips/:tripId/track", authenticate, c.trackTrip);

/**
 * @swagger
 * /api/shared-rides/trips/{tripId}/quote:
 *   post:
 *     tags: [SharedRides]
 *     summary: Báo giá ghế theo pickup/dropoff (backend tự tính, không tin giá FE)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/trips/:tripId/quote", authenticate, c.quoteTrip);
router.post("/trips/:tripId/holds", authenticate, authorizeRoles("renter", "driver", "admin"), c.holdSeats);
router.delete("/holds/:holdId", authenticate, c.releaseHold);

/**
 * @swagger
 * /api/shared-rides/bookings:
 *   post:
 *     tags: [SharedRides]
 *     summary: Tạo booking từ hold
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [holdId]
 *             properties:
 *               holdId: { type: string }
 *               notes: { type: string }
 */
router.post("/bookings", authenticate, authorizeRoles("renter", "driver", "admin"), c.createBooking);
router.get("/bookings/me", authenticate, c.myBookings);
router.get("/bookings/:bookingId", authenticate, c.getBooking);
router.post("/bookings/:bookingId/pay", authenticate, c.payBooking);
router.post("/bookings/:bookingId/cancel", authenticate, c.cancelBooking);
router.get("/tickets/:ticketId", authenticate, c.getTicket);

router.post("/charters/quote", authenticate, c.charterQuote);
router.post("/charters", authenticate, authorizeRoles("renter", "driver", "admin"), c.createCharter);
router.get("/charters/me", authenticate, c.listMyCharters);
router.get("/charters/:charterId", authenticate, c.getCharter);
router.post("/charters/:charterId/pay", authenticate, c.payCharter);

router.get("/admin/trips", authenticate, authorizeRoles("admin", "staff"), c.adminListTrips);
router.get("/admin/bookings", authenticate, authorizeRoles("admin", "staff"), c.adminListBookings);

export default router;
