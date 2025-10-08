import { errorResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";

export function validateDraftApplication(req, res, next) {
  const { personal, applicationId, licenseNumber, licenseExpiry, yearsExperience, services } = req.body || {};
  if (!personal) {
    return res.status(400).json(errorResponse("Thiếu thông tin cá nhân", 400));
  }
  if (applicationId && !mongoose.Types.ObjectId.isValid(applicationId)) {
    return res.status(400).json(errorResponse("applicationId không hợp lệ", 400));
  }
  const nameRegex = /^[A-Za-zÀ-ỹ\s]{2,50}$/;
  if (!personal.fullName || !nameRegex.test(personal.fullName)) {
    return res.status(400).json(errorResponse("Họ tên không hợp lệ", 400));
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!personal.email || !emailRegex.test(personal.email)) {
    return res.status(400).json(errorResponse("Email không hợp lệ", 400));
  }
  if (!personal.phone || !/^(0[3|5|7|8|9])[0-9]{8}$/.test(personal.phone)) {
    return res.status(400).json(errorResponse("Số điện thoại không hợp lệ", 400));
  }
  if (!personal.idNumber) {
    return res.status(400).json(errorResponse("Vui lòng cung cấp số CCCD/CMND", 400));
  }

  // vehicle info no longer required

  // Require license & experience at draft time
  if (!licenseNumber) {
    return res.status(400).json(errorResponse("Thiếu số bằng lái xe", 400));
  }
  if (!licenseExpiry) {
    return res.status(400).json(errorResponse("Thiếu ngày hết hạn bằng lái", 400));
  }
  if (typeof yearsExperience === "undefined" || Number(yearsExperience) < 0) {
    return res.status(400).json(errorResponse("Số năm kinh nghiệm không hợp lệ", 400));
  }
  if (!Array.isArray(services) || services.length === 0) {
    return res.status(400).json(errorResponse("Vui lòng chọn ít nhất một dịch vụ cung cấp", 400));
  }

  next();
}

export function validateSubmitApplication(req, res, next) {
  if (!req.params.id) {
    return res.status(400).json(errorResponse("Thiếu mã hồ sơ", 400));
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json(errorResponse("Mã hồ sơ không hợp lệ", 400));
  }
  next();
}

export function validateApplicationId(req, res, next) {
  if (!req.params.id) {
    return res.status(400).json(errorResponse("Thiếu mã hồ sơ", 400));
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json(errorResponse("Mã hồ sơ không hợp lệ", 400));
  }
  next();
}

export function validateRejectApplication(req, res, next) {
  if (!req.params.id) {
    return res.status(400).json(errorResponse("Thiếu mã hồ sơ", 400));
  }
  if (!req.body || !req.body.reason) {
    return res.status(400).json(errorResponse("Vui lòng cung cấp lý do từ chối", 400));
  }
  next();
}

export function validateAvailability(req, res, next) {
  if (typeof req.body?.online === "undefined") {
    return res.status(400).json(errorResponse("Thiếu trạng thái online", 400));
  }
  next();
}



