import express from "express";
import { calculateFare, createBooking,
     deleteBooking, 
     getAllBookings, 
     getBookingById,
      getBookingsByDriverId, 
      getBookingsByStatus, 
      getBookingsByUserId, 
      updateBooking 
    } from "../controllers/bookingController.js";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Bookings
 *     description: API cho người dùng 
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Tạo mới booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               driverId:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               pickupLocation:
 *                 type: string
 *               dropoffLocation:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Booking created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticate, createBooking);




/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Lấy 1 booking theo ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       '200':
 *         description: Booking fetched successfully
 *       '404':
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/:id", authenticate,authorizeRoles("admin"), getBookingById);

/**
 * @swagger
 * /api/bookings/{id}:
 *   put:
 *     summary: Cập nhật booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               pickupLocation:
 *                 type: string
 *               dropoffLocation:
 *                 type: string
 *               status:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Booking updated successfully
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put("/:id", authenticate,updateBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: Xóa 1 booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete("/:id", authenticate, authorizeRoles("driver", "admin"),deleteBooking);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: Lấy tất cả bookings
 *     tags: [Bookings]
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
 *       - in: query
 *         name: sort
 *         required: false
 *         schema:
 *           type: string
 *         description: Sort by
 *       - in: query
 *         name: sortBookings
 *         required: false
 *         schema:
 *           type: string
 *         description: Sort Bookings
 *     responses:
 *       200:
 *         description: List of all bookings
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/", authenticate, authorizeRoles("admin"),getAllBookings);

/**
 * @swagger
 * /api/bookings/user/{userId}:
 *   get:
 *     summary: Lấy bookings theo user ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
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
 *         description: Bookings fetched successfully
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/user/:userId", authenticate,authorizeRoles("user"), getBookingsByUserId);

/**
 * @swagger
 * /api/bookings/driver/{driverId}:
 *   get:
 *     summary: Lấy bookings theo driver ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Driver ID
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
 *         description: Bookings fetched successfully
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/driver/:driverId", authenticate, authorizeRoles("driver"),getBookingsByDriverId);

/**
 * @swagger
 * /api/bookings/status/{status}:
 *   get:
 *     summary: Lấy bookings theo status
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Pending, Confirmed, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Bookings fetched successfully
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/status/:status", authenticate,authorizeRoles("admin"), getBookingsByStatus);

/**
 * @swagger
 * /api/bookings/calculateFare:
 *   post:
 *     summary: Tính toán giá cước trước khi booking.
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pickupLocation:
 *                 type: string
 *               dropoffLocation:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Fare calculated successfully
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post("/calculateFare", calculateFare);

export default router; 