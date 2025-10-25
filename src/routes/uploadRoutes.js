import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { uploadDriverDocuments, handleUploadError } from "../middlewares/uploadMiddleware.js";
import { uploadDocuments } from "../controllers/uploadController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Upload
 *     description: API cho upload file lên Cloudinary
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Upload thành công"
 *         data:
 *           type: object
 *           properties:
 *             idFrontUrl:
 *               type: string
 *               example: "https://res.cloudinary.com/your_cloud/driver_documents/id_front.jpg"
 *             idBackUrl:
 *               type: string
 *               example: "https://res.cloudinary.com/your_cloud/driver_documents/id_back.jpg"
 *             driverLicenseFrontUrl:
 *               type: string
 *               example: "https://res.cloudinary.com/your_cloud/driver_documents/dl_front.jpg"
 *             driverLicenseBackUrl:
 *               type: string
 *               example: "https://res.cloudinary.com/your_cloud/driver_documents/dl_back.jpg"
 */

/**
 * @swagger
 * /api/upload/documents:
 *   post:
 *     summary: Upload giấy tờ tài xế lên Cloudinary
 *     description: |
 *       Upload các file giấy tờ (ảnh/PDF) lên Cloudinary. 
 *       Hỗ trợ upload tối đa 4 file cùng lúc với kích thước tối đa 5MB/file.
 *       File được lưu trong folder 'driver_documents' trên Cloudinary.
 *       
 *       **Quy trình sử dụng:**
 *       1. Upload file giấy tờ qua endpoint này
 *       2. Sử dụng URLs trả về trong field 'documents' khi tạo/cập nhật hồ sơ
 *       3. Gọi POST /api/driver/applications với document URLs
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               idFront:
 *                 type: string
 *                 format: binary
 *                 description: "Mặt trước CCCD/CMND (JPEG, PNG, PDF - tối đa 5MB)"
 *                 example: "file upload"
 *               idBack:
 *                 type: string
 *                 format: binary
 *                 description: "Mặt sau CCCD/CMND (JPEG, PNG, PDF - tối đa 5MB)"
 *                 example: "file upload"
 *               driverLicenseFront:
 *                 type: string
 *                 format: binary
 *                 description: "Mặt trước bằng lái xe (JPEG, PNG, PDF - tối đa 5MB)"
 *                 example: "file upload"
 *               driverLicenseBack:
 *                 type: string
 *                 format: binary
 *                 description: "Mặt sau bằng lái xe (JPEG, PNG, PDF - tối đa 5MB)"
 *                 example: "file upload"
 *           encoding:
 *             idFront:
 *               contentType: image/jpeg, image/png, image/gif, application/pdf
 *             idBack:
 *               contentType: image/jpeg, image/png, image/gif, application/pdf
 *             driverLicenseFront:
 *               contentType: image/jpeg, image/png, image/gif, application/pdf
 *             driverLicenseBack:
 *               contentType: image/jpeg, image/png, image/gif, application/pdf
 *     responses:
 *       200:
 *         description: Upload thành công - Trả về URLs của các file đã upload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *             examples:
 *               success:
 *                 summary: Upload thành công
 *                 value:
 *                   success: true
 *                   message: "Upload thành công"
 *                   data:
 *                     idFrontUrl: "https://res.cloudinary.com/your_cloud/driver_documents/driver_doc_1234567890_idFront.jpg"
 *                     idBackUrl: "https://res.cloudinary.com/your_cloud/driver_documents/driver_doc_1234567890_idBack.jpg"
 *                     driverLicenseFrontUrl: "https://res.cloudinary.com/your_cloud/driver_documents/driver_doc_1234567890_driverLicenseFront.jpg"
 *                     driverLicenseBackUrl: "https://res.cloudinary.com/your_cloud/driver_documents/driver_doc_1234567890_driverLicenseBack.jpg"
 *       400:
 *         description: Lỗi validate file, kích thước quá lớn, hoặc không có file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "File quá lớn. Kích thước tối đa là 5MB"
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *             examples:
 *               no_files:
 *                 summary: Không có file
 *                 value:
 *                   success: false
 *                   message: "Không có file nào được tải lên"
 *                   statusCode: 400
 *               file_too_large:
 *                 summary: File quá lớn
 *                 value:
 *                   success: false
 *                   message: "File quá lớn. Kích thước tối đa là 5MB"
 *                   statusCode: 400
 *               invalid_type:
 *                 summary: Loại file không hợp lệ
 *                 value:
 *                   success: false
 *                   message: "Chỉ chấp nhận file ảnh (JPEG, PNG, GIF) và PDF"
 *                   statusCode: 400
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *                 statusCode:
 *                   type: integer
 *                   example: 401
 *       500:
 *         description: Lỗi server hoặc Cloudinary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Cloudinary upload failed: Invalid credentials"
 *                 statusCode:
 *                   type: integer
 *                   example: 500
 */
router.post("/documents", authenticate, uploadDriverDocuments, handleUploadError, uploadDocuments);

export default router;
