import express from "express";
import { calculateFare, createBooking,
     deleteBooking, 
     getAllBookings, 
     getBookingById,
      getBookingsByDriverId, 
      getBookingsByStatus, 
      getBookingsByUserId, 
      updateBooking, 
      updateBookingStatus
    } from "../controllers/bookingController.js";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Bookings
 *     description: API cho người dùng 
 */

// /**
//  * @swagger
//  * /api/bookings:
//  *   post:
//  *     summary: Tạo mới booking
//  *     tags: [Bookings]
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               driverId:
//  *                 type: string
//  *               startTime:
//  *                 type: string
//  *                 format: date-time
//  *               endTime:
//  *                 type: string
//  *                 format: date-time
//  *               pickupLocation:
//  *                 type: string
//  *               dropoffLocation:
//  *                 type: string
//  *               price:
//  *                 type: number
//  *               distance:
//  *                 type: number
//  *               duration:
//  *                 type: number
//  *     responses:
//  *       200:
//  *         description: Booking created successfully
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  *       500:
//  *         description: Internal server error
//  */
// router.post("/", authenticate, createBooking);

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Tạo mới booking (theo km, giờ, ngày hoặc liên tỉnh)
 *     tags: [Bookings]
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
 *               - pickupLocation
 *               - startTime
 *             properties:
 *               driverId:
 *                 type: string
 *                 example: "d2b54a17-86fd-4b7b-b2b7-3e893f9fa1f9"
 *               serviceType:
 *                 type: string
 *                 enum: ["per_km", "hourly", "daily", "intercity"]
 *                 description: |
 *                   - `per_km`: Tính giá theo km (bắt buộc điểm đến, không cần endTime)  
 *                   - `intercity`: Đi liên tỉnh (bắt buộc điểm đến, không cần endTime)  
 *                   - `hourly`: Thuê theo giờ (bắt buộc endTime, không cần điểm đến, giới hạn tối đa 8 tiếng)  
 *                   - `daily`: Thuê theo ngày (bắt buộc endTime, không cần điểm đến, giới hạn tối đa 3 ngày)
 *               pickupLocation:
 *                 type: string
 *                 description: Điểm đón khách
 *                 example: "Quận 1, TP.HCM"
 *               dropoffLocation:
 *                 type: string
 *                 description: Chỉ bắt buộc nếu serviceType là 'per_km' hoặc 'intercity'
 *                 example: "Quận Bình Thạnh, TP.HCM"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-06T08:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-06T16:00:00Z"
 *                 description: Chỉ bắt buộc nếu serviceType là 'hourly' hoặc 'daily'
 *               price:
 *                 type: number
 *                 example: 250000
 *               distance:
 *                 type: number
 *                 example: 12.4
 *               duration:
 *                 type: number
 *                 example: 45
 *     responses:
 *       200:
 *         description: Booking created successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
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
//  *     summary: Tính toán giá cước trước khi người dùng xác nhận đặt
//  *     description: |
//  *       API tính tổng giá cước dựa trên:
//  *       - Quãng đường (nếu tính theo km)
//  *       - Thời gian (nếu thuê theo giờ hoặc ngày)
//  *       - Phụ phí theo khung giờ, cuối tuần, ngày lễ  
//  *     tags: [Bookings]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - pickupLocation
//  *               - dropoffLocation
//  *               - startTime
//  *               - endTime
//  *               - serviceType
//  *             properties:
//  *               pickupLocation:
//  *                 type: string
//  *                 example: "Quận 1, TP.HCM"
//  *                 description: Điểm đón khách
//  *               dropoffLocation:
//  *                 type: string
//  *                 example: "Quận 7, TP.HCM"
//  *                 description: Điểm trả khách
//  *               serviceType:
//  *                 type: string
//  *                 enum: [per_km, hourly, daily, intercity]
//  *                 description: Loại dịch vụ (tính theo km, giờ, ngày hoặc đi tỉnh)
//  *               startTime:
//  *                 type: string
//  *                 format: date-time
//  *                 example: "2025-10-06T08:00:00Z"
//  *                 description: Thời gian bắt đầu chuyến đi (ISO 8601 format)
//  *               endTime:
//  *                 type: string
//  *                 format: date-time
//  *                 example: "2025-10-06T16:00:00Z"
//  *                 description: Thời gian kết thúc chuyến đi (bắt buộc khi thuê theo giờ hoặc ngày)
//  *           examples:
//  *             per_km:
//  *               summary: Dịch vụ tính theo km
//  *               value:
//  *                 pickupLocation: "Quận 1, TP.HCM"
//  *                 dropoffLocation: "Quận 7, TP.HCM"
//  *                 startTime: "2025-10-06T21:30:00Z"
//  *                 serviceType: "per_km"
//  *             hourly:
//  *               summary: Dịch vụ thuê theo giờ (4 hoặc 8 tiếng)
//  *               value:
//  *                 pickupLocation: "Quận 1, TP.HCM"
//  *                 dropoffLocation: "Quận Bình Thạnh, TP.HCM"
//  *                 startTime: "2025-10-06T08:00:00Z"
//  *                 endTime: "2025-10-06T12:00:00Z"
//  *                 serviceType: "hourly"
//  *             daily:
//  *               summary: Dịch vụ thuê theo ngày (1–3 ngày)
//  *               value:
//  *                 pickupLocation: "TP.HCM"
//  *                 dropoffLocation: "TP.HCM"
//  *                 startTime: "2025-10-06T08:00:00Z"
//  *                 endTime: "2025-10-08T08:00:00Z"
//  *                 serviceType: "daily"
//  *             intercity:
//  *               summary: Dịch vụ liên tỉnh (70km đầu giá A, 30km sau giá B, >100km giá C)
//  *               value:
//  *                 pickupLocation: "TP.HCM"
//  *                 dropoffLocation: "Vũng Tàu"
//  *                 startTime: "2025-10-06T08:00:00Z"
//  *                 serviceType: "intercity"
//  *     responses:
//  *       200:
//  *         description: Tính toán giá cước thành công
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
//  *                   example: "Tính toán giá cước thành công"
//  *                 data:
//  *                   type: object
//  *                   properties:
//  *                     baseFare:
//  *                       type: number
//  *                       example: 13000
//  *                       description: Đơn giá gốc theo km, giờ hoặc ngày
//  *                     distance:
//  *                       type: number
//  *                       example: 12.5
//  *                       description: Quãng đường tính bằng km (chỉ áp dụng cho per_km, intercity)
//  *                     duration:
//  *                       type: string
//  *                       example: "8 tiếng"
//  *                       description: Thời lượng thuê (áp dụng cho hourly hoặc daily)
//  *                     totalFare:
//  *                       type: number
//  *                       example: 156000
//  *                       description: Tổng tiền sau khi áp dụng phụ phí
//  *                     surcharges:
//  *                       type: object
//  *                       properties:
//  *                         nightSurcharge:
//  *                           type: number
//  *                           example: 8
//  *                           description: Phụ phí ban đêm (%)
//  *                         weekendSurcharge:
//  *                           type: number
//  *                           example: 10
//  *                           description: Phụ phí cuối tuần (%)
//  *                         holidaySurcharge:
//  *                           type: number
//  *                           example: 18
//  *                           description: Phụ phí ngày lễ (%)
//  *                         openingFee:
//  *                           type: number
//  *                           example: 50000
//  *                           description: Phí mở cửa cố định
//  *       400:
//  *         description: Thiếu hoặc sai dữ liệu đầu vào
//  *       401:
//  *         description: Chưa xác thực
//  *       403:
//  *         description: Không có quyền truy cập
//  *       500:
//  *         description: Lỗi máy chủ nội bộ
//  */
// router.post("/calculateFare", calculateFare);

/**
 * @swagger
 * /api/bookings/calculateFare:
 *   post:
 *     summary: Tính toán giá cước trước khi người dùng xác nhận đặt
 *     description: |
 *       API tính tổng giá cước dựa trên:
 *       - Quãng đường (nếu tính theo km hoặc liên tỉnh)
 *       - Thời gian (nếu thuê theo giờ hoặc ngày)
 *       - Phụ phí theo khung giờ, cuối tuần, ngày lễ  
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickupLocation
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
 *                 description: Điểm trả khách (bắt buộc nếu dịch vụ per_km hoặc intercity)
 *               serviceType:
 *                 type: string
 *                 enum: [per_km, hourly, daily, intercity]
 *                 description: Loại dịch vụ (tính theo km, giờ, ngày hoặc đi tỉnh)
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-06T08:00:00Z"
 *                 description: Thời gian bắt đầu chuyến đi (ISO 8601 format)
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-06T16:00:00Z"
 *                 description: Thời gian kết thúc chuyến đi (bắt buộc khi thuê theo giờ hoặc ngày)
 *           examples:
 *             per_km:
 *               summary: Dịch vụ tính theo km
 *               value:
 *                 pickupLocation: "Quận 1, TP.HCM"
 *                 dropoffLocation: "Quận 7, TP.HCM"
 *                 startTime: "2025-10-06T21:30:00Z"
 *                 serviceType: "per_km"
 *             hourly:
 *               summary: Dịch vụ thuê theo giờ (4 hoặc 8 tiếng)
 *               value:
 *                 pickupLocation: "Quận 1, TP.HCM"
 *                 startTime: "2025-10-06T08:00:00Z"
 *                 endTime: "2025-10-06T12:00:00Z"
 *                 serviceType: "hourly"
 *             daily:
 *               summary: Dịch vụ thuê theo ngày (1–3 ngày)
 *               value:
 *                 pickupLocation: "TP.HCM"
 *                 startTime: "2025-10-06T08:00:00Z"
 *                 endTime: "2025-10-08T08:00:00Z"
 *                 serviceType: "daily"
 *             intercity:
 *               summary: Dịch vụ liên tỉnh (70km đầu giá A, 30km sau giá B, >100km giá C)
 *               value:
 *                 pickupLocation: "TP.HCM"
 *                 dropoffLocation: "Vũng Tàu"
 *                 startTime: "2025-10-06T08:00:00Z"
 *                 serviceType: "intercity"
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
 *                       description: Đơn giá gốc theo km, giờ hoặc ngày
 *                     distance:
 *                       type: number
 *                       example: 12.5
 *                       description: Quãng đường tính bằng km (chỉ áp dụng cho per_km, intercity)
 *                     duration:
 *                       type: string
 *                       example: "4 tiếng"
 *                       description: Thời lượng thuê (áp dụng cho hourly hoặc daily)
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
 *                           description: Phụ phí cuối tuần (%)
 *                         holidaySurcharge:
 *                           type: number
 *                           example: 18
 *                           description: Phụ phí ngày lễ (%)
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


/**
 * @swagger
 * /api/bookings/updateStatus/{id}:
 *   patch:
 *     summary: Cập nhật trạng thái booking
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
 *               status:
 *                 type: string
 *                 enum: [Pending, Confirmed, Ongoing, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Booking status updated successfully
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Internal server error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch("/updateStatus/:id", authenticate, updateBookingStatus);



export default router; 