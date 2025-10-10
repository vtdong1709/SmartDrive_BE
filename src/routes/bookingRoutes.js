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
 *               distance:
 *                 type: number
 *               duration:
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
 * /api/bookings/get/{id}:
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
router.get("/get/:id", authenticate,authorizeRoles("admin","driver","renter"), getBookingById);

/**
 * @swagger
 * /api/bookings/update/{id}:
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
router.put("/update/:id", authenticate,updateBooking);

/**
 * @swagger
 * /api/bookings/delete/{id}:
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
router.delete("/delete/:id", authenticate, authorizeRoles("driver", "admin"),deleteBooking);

/**
 * @swagger
 * /api/bookings/get-all:
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
router.get("/get-all", authenticate, authorizeRoles("admin"),getAllBookings);

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

// /**
//  * @swagger
//  * /api/bookings/calculateFare:
//  *   post:
//  *     summary: Tính toán giá cước trước khi booking.
//  *     tags: [Bookings]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               pickupLocation:
//  *                 type: string
//  *               dropoffLocation:
//  *                 type: string
//  *               startTime:
//  *                 type: string
//  *                 format: date-time
//  *               serviceType:
//  *                 type: string
//  *                 enum: [hourly, daily, airport_transfer]
//  *                 description: Loại dịch vụ áp dụng bảng giá
//  *     responses:
//  *       200:
//  *         description: Fare calculated successfully
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
//  *                   example: "Fare calculated successfully"
//  *                 data:
//  *                   $ref: '#/components/schemas/Fare'
//  *       400:
//  *         description: Bad request
//  *       500:
//  *         description: Internal server error
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  */
// router.post("/calculateFare", calculateFare);

/**
 * @swagger
 * /api/bookings/calculateFare:
 *   post:
 *     summary: Tính toán giá cước trước khi người dùng xác nhận đặt.
 *     description: 
 *       API này sẽ tính toán tổng giá dựa trên quãng đường, thời gian, loại dịch vụ, giờ trong ngày, và phụ phí (cuối tuần, ngày lễ, khung giờ đặc biệt).  
 *       **Không bao gồm phí chờ.**
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickupLocation
 *               - dropoffLocation
 *               - startTime
 *               - serviceType
 *             properties:
 *               pickupLocation:
 *                 type: string
 *                 example: "Quận 1, TP.HCM"
 *                 description: Điểm đón khách
 *               dropoffLocation:
 *                 type: string
 *                 example: "Quận 7, TP.HCM"
 *                 description: Điểm trả khách
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-06T21:30:00Z"
 *                 description: Thời gian bắt đầu chuyến đi (ISO 8601 format)
 *               serviceType:
 *                 type: string
 *                 enum: [per_km, hourly, daily, intercity]
 *                 example: "hourly"
 *                 description: Loại dịch vụ (tính theo km, giờ, ngày hoặc đi tỉnh)
 *     responses:
 *       200:
 *         description: Tính toán giá cước thành công
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
 *                   example: "Tính toán giá cước thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     baseFare:
 *                       type: number
 *                       example: 13000
 *                       description: Đơn giá gốc theo km hoặc giờ
 *                     distance:
 *                       type: number
 *                       example: 12.5
 *                       description: Quãng đường tính bằng km
 *                     totalFare:
 *                       type: number
 *                       example: 156000
 *                       description: Tổng tiền sau khi áp dụng phụ phí
 *                     surcharges:
 *                       type: object
 *                       properties:
 *                         nightSurcharge:
 *                           type: number
 *                           example: 8
 *                           description: Phụ phí ban đêm (%)
 *                         weekendSurcharge:
 *                           type: number
 *                           example: 10
 *                         holidaySurcharge:
 *                           type: number
 *                           example: 18
 *                         openingFee:
 *                           type: number
 *                           example: 50000
 *                           description: Phí mở cửa cố định
 *       400:
 *         description: Thiếu hoặc sai dữ liệu đầu vào
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
router.post("/calculateFare", calculateFare);


export default router; 