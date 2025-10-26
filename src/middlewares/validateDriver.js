import { errorResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";

export function validateDraftApplication(req, res, next) {
  const { personal, address, applicationId, licenseNumber, licenseExpiry, yearsExperience, services } = req.body || {};
  
  // Validate applicationId if provided
  if (applicationId && !mongoose.Types.ObjectId.isValid(applicationId)) {
    return res.status(400).json(errorResponse("applicationId không hợp lệ", 400));
  }

  // Validate personal fields only if provided
  if (personal) {
    const nameRegex = /^[A-Za-zÀ-ỹ\s]{2,50}$/;
    if (personal.fullName && !nameRegex.test(personal.fullName)) {
      return res.status(400).json(errorResponse("Họ tên không hợp lệ", 400));
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (personal.email && !emailRegex.test(personal.email)) {
      return res.status(400).json(errorResponse("Email không hợp lệ", 400));
    }
    
    if (personal.phone && !/^(0[3|5|7|8|9])[0-9]{8}$/.test(personal.phone)) {
      return res.status(400).json(errorResponse("Số điện thoại không hợp lệ", 400));
    }
  }

  // Validate address fields only if provided
  if (address) {
    if (address.province && address.province.trim().length === 0) {
      return res.status(400).json(errorResponse("Tỉnh/thành phố không được để trống", 400));
    }
    if (address.district && address.district.trim().length === 0) {
      return res.status(400).json(errorResponse("Quận/huyện không được để trống", 400));
    }
    if (address.ward && address.ward.trim().length === 0) {
      return res.status(400).json(errorResponse("Phường/xã không được để trống", 400));
    }
    if (address.specificAddress && address.specificAddress.trim().length === 0) {
      return res.status(400).json(errorResponse("Địa chỉ cụ thể không được để trống", 400));
    }
  }

  // Validate license fields only if provided
  if (licenseNumber && licenseNumber.trim().length === 0) {
    return res.status(400).json(errorResponse("Số bằng lái xe không được để trống", 400));
  }
  
  if (licenseExpiry && isNaN(new Date(licenseExpiry).getTime())) {
    return res.status(400).json(errorResponse("Ngày hết hạn bằng lái không hợp lệ", 400));
  }
  
  if (typeof yearsExperience !== "undefined" && Number(yearsExperience) < 0) {
    return res.status(400).json(errorResponse("Số năm kinh nghiệm không hợp lệ", 400));
  }
  
  if (Array.isArray(services) && services.length === 0) {
    return res.status(400).json(errorResponse("Danh sách dịch vụ không được để trống", 400));
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



