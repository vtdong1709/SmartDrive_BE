import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  approveApplication,
  getApplicationById,
  getMyApplication,
  listApplications,
  rejectApplication,
  setMyAvailability,
  submitApplication,
  upsertDraftApplication,
  updateMyApplication,
  deleteMyApplication,
} from "../controllers/driverController.js";
import {
  validateAvailability,
  validateDraftApplication,
  validateRejectApplication,
  validateSubmitApplication,
  validateApplicationId,
} from "../middlewares/validateDriver.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Driver Application
 *     description: API cho người dùng nộp và theo dõi hồ sơ tài xế
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DriverPersonal:
 *       type: object
 *       required: [fullName, phone, email, idNumber]
 *       properties:
 *         fullName:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         phone:
 *           type: string
 *           example: "0912345678"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         idNumber:
 *           type: string
 *           example: "079123456789"
 *     DriverVehicle:
 *       type: object
 *       required: [type, brand, model, year, plate, color]
 *       properties:
 *         type:
 *           type: string
 *           example: "motorbike"
 *         brand:
 *           type: string
 *           example: "Honda"
 *         model:
 *           type: string
 *           example: "Wave RSX"
 *         year:
 *           type: integer
 *           example: 2020
 *         plate:
 *           type: string
 *           example: "59A1-123.45"
 *         color:
 *           type: string
 *           example: "black"
 *     DriverDocuments:
 *       type: object
 *       required: [idFrontUrl, idBackUrl, driverLicenseFrontUrl, driverLicenseBackUrl]
 *       properties:
 *         idFrontUrl:
 *           type: string
 *           example: "https://files.example.com/id-front.jpg"
 *         idBackUrl:
 *           type: string
 *           example: "https://files.example.com/id-back.jpg"
 *         driverLicenseFrontUrl:
 *           type: string
 *           example: "https://files.example.com/driver-license-front.jpg"
 *         driverLicenseBackUrl:
 *           type: string
 *           example: "https://files.example.com/driver-license-back.jpg"
 *     DriverApplication:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *         rejectionReason:
 *           type: string
 *           nullable: true
  *         licenseNumber:
  *           type: string
  *           example: "B2-123456789"
  *         licenseExpiry:
  *           type: string
  *           format: date
  *           example: "2028-12-31"
  *         yearsExperience:
  *           type: integer
  *           example: 3
  *         services:
  *           type: array
  *           items:
  *             type: string
  *             enum: [drive_by_hour, city_service, long_distance, interprovincial_tourism, vip, premium_clients, airport_pickup, airport_specialist]
 *         personal:
 *           $ref: '#/components/schemas/DriverPersonal'
 *         vehicle:
 *           $ref: '#/components/schemas/DriverVehicle'
 *         documents:
 *           $ref: '#/components/schemas/DriverDocuments'
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         decidedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
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
 *     DriverApplicationDraftRequest:
 *       type: object
 *       required: [personal, vehicle, licenseNumber, licenseExpiry, yearsExperience, services]
 *       properties:
  *         applicationId:
  *           type: string
  *           description: Optional. If provided, updates the specified draft (must belong to user)
 *         personal:
 *           $ref: '#/components/schemas/DriverPersonal'
 *         vehicle:
 *           $ref: '#/components/schemas/DriverVehicle'
 *         documents:
 *           $ref: '#/components/schemas/DriverDocuments'
 *         licenseNumber:
 *           type: string
 *           example: "B2-123456789"
 *         licenseExpiry:
 *           type: string
 *           format: date
 *           example: "2028-12-31"
 *         yearsExperience:
 *           type: integer
 *           example: 3
 *         services:
 *           type: array
 *           items:
 *             type: string
 *             enum: [drive_by_hour, city_service, long_distance, interprovincial_tourism, vip, premium_clients, airport_pickup, airport_specialist]
 *     AvailabilityRequest:
 *       type: object
 *       required: [online]
 *       properties:
 *         online:
 *           type: boolean
 *           example: true
 *     PaginatedApplications:
 *       type: object
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DriverApplication'
 *         total:
 *           type: integer
 *           example: 1
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
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
 * /api/applications:
 *   post:
 *     summary: Tạo hoặc cập nhật hồ sơ nháp
 *     tags: [Driver Application]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DriverApplicationDraftRequest'
  *           examples:
 *             create:
  *               summary: Tạo hồ sơ nháp mới (đủ tài liệu bắt buộc)
  *               value:
  *                 personal:
  *                   fullName: "Nguyễn Văn A"
  *                   phone: "0912345678"
  *                   email: "user@example.com"
  *                   idNumber: "079123456789"
  *                 vehicle:
  *                   type: "car"
  *                   brand: "Toyota"
  *                   model: "Vios"
  *                   year: 2020
  *                   plate: "59A1-123.45"
  *                   color: "black"
 *                 documents:
  *                   idFrontUrl: "https://files.example.com/id-front.jpg"
  *                   idBackUrl: "https://files.example.com/id-back.jpg"
  *                   driverLicenseFrontUrl: "https://files.example.com/dl-front.jpg"
  *                   driverLicenseBackUrl: "https://files.example.com/dl-back.jpg"
 *                 licenseNumber: "B2-123456789"
 *                 licenseExpiry: "2028-12-31"
 *                 yearsExperience: 3
 *                 services: ["drive_by_hour", "city_service"]
  *             update:
  *               summary: Cập nhật hồ sơ nháp hiện có
  *               value:
  *                 applicationId: "653fd3b7a1c2e3456789abcd"
  *                 personal:
  *                   fullName: "Nguyễn Văn A"
  *                   phone: "0912345678"
  *                   email: "user@example.com"
  *                   idNumber: "079123456789"
  *                 vehicle:
  *                   type: "car"
  *                   brand: "Toyota"
  *                   model: "Vios"
  *                   year: 2020
  *                   plate: "59A1-123.45"
  *                   color: "black"
 *                 documents:
  *                   idFrontUrl: "https://files.example.com/id-front.jpg"
  *                   idBackUrl: "https://files.example.com/id-back.jpg"
  *                   driverLicenseFrontUrl: "https://files.example.com/dl-front.jpg"
  *                   driverLicenseBackUrl: "https://files.example.com/dl-back.jpg"
 *                 licenseNumber: "B2-123456789"
 *                 licenseExpiry: "2028-12-31"
 *                 yearsExperience: 5
 *                 services: ["long_distance", "airport_pickup"]
 *     responses:
  *       201:
  *         description: Tạo hồ sơ nháp mới thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverApplication'
  *       200:
  *         description: Cập nhật hồ sơ nháp thành công
  *         content:
  *           application/json:
  *             schema:
  *               allOf:
  *                 - $ref: '#/components/schemas/ApiResponse'
  *                 - type: object
  *                   properties:
  *                     data:
  *                       $ref: '#/components/schemas/DriverApplication'
 *       400:
 *         description: Lỗi validate
 */
router.post("/applications", authenticate, validateDraftApplication, upsertDraftApplication);

/**
 * @swagger
 * /api/applications/me:
 *   get:
 *     summary: Lấy tất cả hồ sơ của tôi
 *     tags: [Driver Application]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách hồ sơ thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DriverApplication'
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.get("/applications/me", authenticate, getMyApplication);

/**
 * @swagger
 * /api/applications/{id}/submit:
 *   post:
 *     summary: Gửi hồ sơ để duyệt
 *     tags: [Driver Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gửi hồ sơ thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverApplication'
 *       400:
 *         description: Thiếu giấy tờ bắt buộc hoặc trạng thái không hợp lệ
 */
router.post("/applications/:id/submit", authenticate, validateSubmitApplication, submitApplication);

/**
 * @swagger
 * /api/applications/{id}:
 *   patch:
 *     summary: Cập nhật hồ sơ theo id (chỉ nháp/bị từ chối)
 *     tags: [Driver Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DriverApplicationDraftRequest'
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
 *                       $ref: '#/components/schemas/DriverApplication'
 */
router.patch("/applications/:id", authenticate, validateApplicationId, updateMyApplication);

/**
 * @swagger
 * /api/applications/{id}:
 *   delete:
 *     summary: Xóa hồ sơ theo id (chỉ nháp/bị từ chối)
 *     tags: [Driver Application]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         deleted:
 *                           type: boolean
 *                           example: true
 */
router.delete("/applications/:id", authenticate, validateApplicationId, deleteMyApplication);

/**
 * @swagger
 * tags:
 *   - name: Admin-Drivers
 *     description: API cho admin duyệt hồ sơ tài xế
 */

/**
 * @swagger
 * /api/admin/driver-applications:
 *   get:
  *     summary: (Admin/Staff) Danh sách hồ sơ tài xế
 *     tags: [Admin-Drivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
  *       - in: query
  *         name: createdFrom
  *         schema:
  *           type: string
  *           format: date-time
  *         description: ISO date, filter createdAt >= createdFrom
  *       - in: query
  *         name: createdTo
  *         schema:
  *           type: string
  *           format: date-time
  *         description: ISO date, filter createdAt <= createdTo
  *       - in: query
  *         name: yearsMin
  *         schema:
  *           type: integer
  *       - in: query
  *         name: yearsMax
  *         schema:
  *           type: integer
  *       - in: query
  *         name: services
  *         schema:
  *           type: string
  *         description: CSV of services (e.g. drive_by_hour,city_service)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/PaginatedApplications'
 */
router.get("/admin/driver-applications", authenticate, authorizeRoles("admin", "staff"), listApplications);

/**
 * @swagger
 * /api/admin/driver-applications/{id}:
 *   get:
 *     summary: (Admin/Staff) Chi tiết hồ sơ
 *     tags: [Admin-Drivers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverApplication'
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.get("/admin/driver-applications/:id", authenticate, authorizeRoles("admin", "staff"), getApplicationById);

/**
 * @swagger
 * /api/admin/driver-applications/{id}/approve:
 *   post:
 *     summary: (Admin) Duyệt hồ sơ
 *     tags: [Admin-Drivers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Duyệt thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         app:
 *                           $ref: '#/components/schemas/DriverApplication'
 *                         profile:
 *                           $ref: '#/components/schemas/DriverProfile'
 */
router.post("/admin/driver-applications/:id/approve", authenticate, authorizeRoles("admin"), approveApplication);

/**
 * @swagger
 * /api/admin/driver-applications/{id}/reject:
 *   post:
 *     summary: (Admin) Từ chối hồ sơ
 *     tags: [Admin-Drivers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Từ chối thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DriverApplication'
 */
router.post(
  "/admin/driver-applications/:id/reject",
  authenticate,
  authorizeRoles("admin"),
  validateRejectApplication,
  rejectApplication
);

/**
 * @swagger
 * /api/drivers/me/availability:
 *   patch:
 *     summary: Bật/tắt trạng thái sẵn sàng nhận cuốc (chỉ tài xế đã duyệt)
 *     tags: [Driver Application]
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
router.patch("/drivers/me/availability", authenticate, authorizeRoles("driver"), validateAvailability, setMyAvailability);

export default router;


