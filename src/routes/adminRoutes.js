import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";
import {
  approveApplication,
  getApplicationById,
  listApplications,
  rejectApplication,
} from "../controllers/driverController.js";
import { validateRejectApplication } from "../middlewares/validateDriver.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: API cho admin quản lý hồ sơ tài xế
 */

/**
 * @swagger
 * components:
 *   schemas:
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
 */

/**
 * @swagger
 * /api/admin/driver-applications:
 *   get:
 *     summary: (Admin/Staff) Danh sách hồ sơ tài xế
 *     tags: [Admin]
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
 *         description: CSV of services (e.g. dich_vu_tai_xe_theo_gio,dich_vu_tai_xe_theo_cay_so)
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
 *               $ref: '#/components/schemas/PaginatedApplications'
 */
router.get("/driver-applications", authenticate, authorizeRoles("admin", "staff"), listApplications);

/**
 * @swagger
 * /api/admin/driver-applications/{id}:
 *   get:
 *     summary: (Admin/Staff) Chi tiết hồ sơ
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.get("/driver-applications/:id", authenticate, authorizeRoles("admin", "staff"), getApplicationById);

/**
 * @swagger
 * /api/admin/driver-applications/{id}/approve:
 *   post:
 *     summary: (Admin) Duyệt hồ sơ
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Duyệt thành công
 */
router.post("/driver-applications/:id/approve", authenticate, authorizeRoles("admin"), approveApplication);

/**
 * @swagger
 * /api/admin/driver-applications/{id}/reject:
 *   post:
 *     summary: (Admin) Từ chối hồ sơ
 *     tags: [Admin]
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
 */
router.post(
  "/driver-applications/:id/reject",
  authenticate,
  authorizeRoles("admin"),
  validateRejectApplication,
  rejectApplication
);

export default router;





