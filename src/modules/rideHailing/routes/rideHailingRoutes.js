import express from "express";
import { authenticate, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import * as c from "../controllers/rideHailingController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: RideHailing
 *     description: Đặt xe di chuyển (Grab-like, độc lập Driver Rental / Shared Ride / Self Drive)
 */

/**
 * @swagger
 * /api/rides/categories:
 *   get:
 *     tags: [RideHailing]
 *     summary: Danh sách loại xe (MOTORBIKE, CAR_4, EV_4, ...)
 * /api/rides/quote:
 *   post:
 *     tags: [RideHailing]
 *     summary: Báo giá server-side (quoteId + expiresAt)
 *     security: [{ bearerAuth: [] }]
 * /api/rides:
 *   post:
 *     tags: [RideHailing]
 *     summary: Tạo chuyến từ quote còn hạn
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quoteId]
 *             properties:
 *               quoteId: { type: string }
 *               bookingType: { type: string, enum: [IMMEDIATE, SCHEDULED] }
 *               scheduledAt: { type: string, format: date-time }
 *               paymentMethod: { type: string, enum: [vnpay, payos, cash] }
 * /api/rides/history:
 *   get:
 *     tags: [RideHailing]
 *     summary: Lịch sử khách
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}:
 *   get:
 *     tags: [RideHailing]
 *     summary: Chi tiết chuyến (ẩn PII tài xế trước khi assign)
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/status:
 *   get:
 *     tags: [RideHailing]
 *     summary: Trạng thái + ETA tài xế
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/driver-location:
 *   get:
 *     tags: [RideHailing]
 *     summary: GPS tài xế sau khi assign
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/otp:
 *   get:
 *     tags: [RideHailing]
 *     summary: Khách lấy OTP nhận xe (hash lưu server)
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/cancel:
 *   post:
 *     tags: [RideHailing]
 *     summary: Hủy chuyến
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/rate:
 *   post:
 *     tags: [RideHailing]
 *     summary: Đánh giá sau COMPLETED
 *     security: [{ bearerAuth: [] }]
 * /api/rides/{id}/pay:
 *   post:
 *     tags: [RideHailing]
 *     summary: Thanh toán VNPay/PayOS (purpose ride_hailing)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/categories", c.listCategories);
router.post("/quote", authenticate, authorizeRoles("renter", "driver", "admin"), c.quoteRide);
router.get("/history", authenticate, c.myHistory);
router.post("/", authenticate, authorizeRoles("renter", "driver", "admin"), c.createRide);

/**
 * @swagger
 * /api/rides/driver/offers:
 *   get:
 *     tags: [RideHailing]
 *     summary: Offer đang chờ tài xế
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/offers/{offerId}/accept:
 *   post:
 *     tags: [RideHailing]
 *     summary: Accept (race-safe, chỉ 1 tài xế thắng)
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/offers/{offerId}/reject:
 *   post:
 *     tags: [RideHailing]
 *     summary: Từ chối offer
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/active:
 *   get:
 *     tags: [RideHailing]
 *     summary: Chuyến đang chạy của tài xế
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/history:
 *   get:
 *     tags: [RideHailing]
 *     summary: Lịch sử tài xế
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/earnings:
 *   get:
 *     tags: [RideHailing]
 *     summary: Tổng thu nhập (gross / fee / net)
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/vehicle:
 *   get:
 *     tags: [RideHailing]
 *     summary: Xe đăng ký nhận ride
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [RideHailing]
 *     summary: Đăng ký/cập nhật xe ride-hailing
 *     security: [{ bearerAuth: [] }]
 * /api/rides/driver/location:
 *   post:
 *     tags: [RideHailing]
 *     summary: Cập nhật GPS tài xế
 *     security: [{ bearerAuth: [] }]
 */
router.get("/driver/offers", authenticate, authorizeRoles("driver", "admin"), c.driverOffers);
router.post("/driver/offers/:offerId/accept", authenticate, authorizeRoles("driver", "admin"), c.acceptOffer);
router.post("/driver/offers/:offerId/reject", authenticate, authorizeRoles("driver", "admin"), c.rejectOffer);
router.get("/driver/active", authenticate, authorizeRoles("driver", "admin"), c.driverActive);
router.get("/driver/history", authenticate, authorizeRoles("driver", "admin"), c.driverHistory);
router.get("/driver/earnings", authenticate, authorizeRoles("driver", "admin"), c.driverEarnings);
router.get("/driver/vehicle", authenticate, authorizeRoles("driver", "admin"), c.myVehicle);
router.post("/driver/vehicle", authenticate, authorizeRoles("driver", "admin"), c.upsertVehicle);
router.post("/driver/location", authenticate, authorizeRoles("driver", "admin"), c.updateLocation);

/**
 * @swagger
 * /api/rides/admin/rides:
 *   get:
 *     tags: [RideHailing]
 *     summary: Admin list rides
 *     security: [{ bearerAuth: [] }]
 * /api/rides/admin/rides/{id}:
 *   get:
 *     tags: [RideHailing]
 *     summary: Admin ride detail + statusHistory
 *     security: [{ bearerAuth: [] }]
 * /api/rides/admin/categories/{code}:
 *   patch:
 *     tags: [RideHailing]
 *     summary: Cập nhật pricing category
 *     security: [{ bearerAuth: [] }]
 */
router.get("/admin/rides", authenticate, authorizeRoles("admin", "staff"), c.adminRides);
router.get("/admin/rides/:id", authenticate, authorizeRoles("admin", "staff"), c.adminRideDetail);
router.post("/admin/rides/:id/cancel", authenticate, authorizeRoles("admin", "staff"), c.cancelRide);
router.patch("/admin/categories/:code", authenticate, authorizeRoles("admin", "staff"), c.adminUpdateCategory);

router.get("/:id", authenticate, c.getRide);
router.get("/:id/status", authenticate, c.getRideStatus);
router.get("/:id/driver-location", authenticate, c.getDriverLocation);
router.get("/:id/otp", authenticate, c.getOtp);
router.post("/:id/cancel", authenticate, c.cancelRide);
router.post("/:id/rate", authenticate, c.rateRide);
router.post("/:id/pay", authenticate, c.payRide);
router.post("/:id/arrived", authenticate, authorizeRoles("driver", "admin"), c.arriveRide);
router.post("/:id/verify-otp", authenticate, authorizeRoles("driver", "admin"), c.verifyOtp);
router.post("/:id/start", authenticate, authorizeRoles("driver", "admin"), c.startRide);
router.post("/:id/complete", authenticate, authorizeRoles("driver", "admin"), c.completeRide);

export default router;
