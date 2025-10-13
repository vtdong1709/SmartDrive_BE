import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import {
  // createAndSendNotification,
  getMyApplication,
  submitApplication,
  upsertDraftApplication,
  updateMyApplication,
  deleteMyApplication,
  getApplicationById,
  getApplicationByDriverId,
} from "../controllers/driverController.js";
import {
  validateDraftApplication,
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
 *     DriverAddress:
 *       type: object
 *       required: [province, district, ward, specificAddress]
 *       properties:
 *         province:
 *           type: string
 *           example: "Hồ Chí Minh"
 *           description: "Tỉnh/Thành phố"
 *         district:
 *           type: string
 *           example: "Quận 1"
 *           description: "Quận/Huyện"
 *         ward:
 *           type: string
 *           example: "Phường Bến Nghé"
 *           description: "Phường/Xã"
 *         specificAddress:
 *           type: string
 *           example: "123 Đường Nguyễn Huệ"
 *           description: "Địa chỉ cụ thể"
 *     # Vehicle schema removed
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
  *             enum: [dich_vu_tai_xe_theo_gio, dich_vu_tai_xe_theo_cay_so, dich_vu_tai_xe_theo_ngay, dich_vu_tai_xe_lien_tinh]
 *         personal:
 *           $ref: '#/components/schemas/DriverPersonal'
 *         address:
 *           $ref: '#/components/schemas/DriverAddress'
 *         # vehicle removed
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
 *     DriverApplicationDraftRequest:
 *       type: object
 *       required: [personal, address, licenseNumber, licenseExpiry, yearsExperience, services]
 *       properties:
  *         applicationId:
  *           type: string
  *           description: Optional. If provided, updates the specified draft (must belong to user)
 *         personal:
 *           $ref: '#/components/schemas/DriverPersonal'
 *         address:
 *           $ref: '#/components/schemas/DriverAddress'
 *         # vehicle removed
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
 *             enum: [dich_vu_tai_xe_theo_gio, dich_vu_tai_xe_theo_cay_so, dich_vu_tai_xe_theo_ngay, dich_vu_tai_xe_lien_tinh]
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
 * /api/driver/applications:
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
 *                 address:
 *                   province: "Hồ Chí Minh"
 *                   district: "Quận 1"
 *                   ward: "Phường Bến Nghé"
 *                   specificAddress: "123 Đường Nguyễn Huệ"
 *                 # vehicle removed
 *                 documents:
  *                   idFrontUrl: "https://files.example.com/id-front.jpg"
  *                   idBackUrl: "https://files.example.com/id-back.jpg"
  *                   driverLicenseFrontUrl: "https://files.example.com/dl-front.jpg"
  *                   driverLicenseBackUrl: "https://files.example.com/dl-back.jpg"
 *                 licenseNumber: "B2-123456789"
 *                 licenseExpiry: "2028-12-31"
 *                 yearsExperience: 3
 *                 services: ["dich_vu_tai_xe_theo_gio", "dich_vu_tai_xe_theo_cay_so"]
  *             update:
  *               summary: Cập nhật hồ sơ nháp hiện có
  *               value:
  *                 applicationId: "653fd3b7a1c2e3456789abcd"
  *                 personal:
  *                   fullName: "Nguyễn Văn A"
  *                   phone: "0912345678"
  *                   email: "user@example.com"
  *                   idNumber: "079123456789"
 *                 address:
 *                   province: "Hồ Chí Minh"
 *                   district: "Quận 1"
 *                   ward: "Phường Bến Nghé"
 *                   specificAddress: "123 Đường Nguyễn Huệ"
 *                 # vehicle removed
 *                 documents:
  *                   idFrontUrl: "https://files.example.com/id-front.jpg"
  *                   idBackUrl: "https://files.example.com/id-back.jpg"
  *                   driverLicenseFrontUrl: "https://files.example.com/dl-front.jpg"
  *                   driverLicenseBackUrl: "https://files.example.com/dl-back.jpg"
 *                 licenseNumber: "B2-123456789"
 *                 licenseExpiry: "2028-12-31"
 *                 yearsExperience: 5
 *                 services: ["dich_vu_tai_xe_theo_ngay", "dich_vu_tai_xe_lien_tinh"]
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
 * /api/driver/applications/{id}:
 *   get:
 *     summary: Lấy hồ sơ theo id của tài xế
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
 *         description: Lấy hồ sơ thành công
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
router.get("/applications/:id", authenticate, validateApplicationId, getApplicationByDriverId);

/**
 * @swagger
 * /api/driver/applications/me:
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
 * /api/driver/applications/{id}/submit:
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
 * /api/driver/applications/{id}:
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
 * /api/driver/applications/{id}:
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

export default router;
