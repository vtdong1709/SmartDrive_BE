import DriverApplication from "../models/DriverApplication.js";
import DriverProfile from "../models/DriverProfile.js";
import User from "../models/User.js";
import {
  notifyApplicationApproved,
  notifyApplicationRejected,
  notifyApplicationSubmitted,
} from "./notificationService.js";

/**
 * Ensure user exists and is verified
 */
async function ensureActiveUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error("Không tìm thấy người dùng"), { statusCode: 404 });
  }
  if (!user.verified) {
    throw Object.assign(new Error("Tài khoản chưa xác thực email"), { statusCode: 403 });
  }
  return user;
}

/**
 * Get latest application of a user (any status)
 */
export async function getMyApplicationService(userId) {
  await ensureActiveUser(userId);
  const apps = await DriverApplication.find({ userId }).sort({ createdAt: -1 });
  return apps; // return empty array if none
}

/**
 * Create or update draft application
 */
export async function upsertDraftApplicationService(userId, payload) {
  await ensureActiveUser(userId);

  // If payload has applicationId, update that draft; else, create a new draft
  if (payload?.applicationId) {
    const app = await DriverApplication.findOne({ _id: payload.applicationId, userId });
    if (!app) {
      throw Object.assign(new Error("Không tìm thấy hồ sơ để cập nhật"), { statusCode: 404 });
    }
    if (app.status !== "draft" && app.status !== "rejected") {
      throw Object.assign(new Error("Chỉ cập nhật khi hồ sơ ở trạng thái nháp/bị từ chối"), { statusCode: 400 });
    }
    app.personal = payload.personal ?? app.personal;
    app.vehicle = payload.vehicle ?? app.vehicle;
    if (payload.documents) {
      app.documents = { ...app.documents, ...payload.documents };
    }
    if (typeof payload.licenseNumber !== "undefined") app.licenseNumber = payload.licenseNumber;
    if (typeof payload.licenseExpiry !== "undefined") app.licenseExpiry = payload.licenseExpiry;
    if (typeof payload.yearsExperience !== "undefined") app.yearsExperience = payload.yearsExperience;
    if (Array.isArray(payload.services)) app.services = payload.services;
    await app.save();
    return { app, isNew: false };
  }

  // Create new draft application
  const created = await DriverApplication.create({
    userId,
    status: "draft",
    personal: payload.personal,
    vehicle: payload.vehicle,
    documents: payload.documents || {},
    licenseNumber: payload.licenseNumber,
    licenseExpiry: payload.licenseExpiry,
    yearsExperience: payload.yearsExperience,
    services: payload.services || [],
  });
  return { app: created, isNew: true };
}

/**
 * Submit application -> status pending
 */
export async function submitApplicationService(userId, applicationId) {
  const user = await ensureActiveUser(userId);
  const app = await DriverApplication.findOne({ _id: applicationId, userId });
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "draft") {
    throw Object.assign(new Error("Chỉ có thể gửi hồ sơ ở trạng thái nháp"), { statusCode: 400 });
  }

  // Validation for completeness on submission
  const docs = app.documents || {};
  const requiredDocFields = [
    "idFrontUrl",
    "idBackUrl",
    "driverLicenseFrontUrl",
    "driverLicenseBackUrl",
  ];
  const missingDocs = requiredDocFields.filter((f) => !docs[f]);
  if (missingDocs.length > 0) {
    throw Object.assign(new Error("Thiếu giấy tờ bắt buộc: " + missingDocs.join(", ")), { statusCode: 400 });
  }
  if (!app.licenseNumber) {
    throw Object.assign(new Error("Thiếu số bằng lái xe"), { statusCode: 400 });
  }
  if (!app.licenseExpiry) {
    throw Object.assign(new Error("Thiếu ngày hết hạn bằng lái"), { statusCode: 400 });
  }
  if (typeof app.yearsExperience !== "number" || app.yearsExperience < 0) {
    throw Object.assign(new Error("Số năm kinh nghiệm không hợp lệ"), { statusCode: 400 });
  }
  if (!Array.isArray(app.services) || app.services.length === 0) {
    throw Object.assign(new Error("Vui lòng chọn ít nhất một dịch vụ cung cấp"), { statusCode: 400 });
  }

  app.status = "pending";
  app.submittedAt = new Date();
  app.rejectionReason = null;
  await app.save();
  // Notify user
  try {
    await notifyApplicationSubmitted(user.email, user.fullName);
  } catch (e) {
    // best-effort; do not block flow
    console.warn("notifyApplicationSubmitted error:", e?.message || e);
  }
  return app;
}

/**
 * Admin: list applications with filters and pagination
 */
export async function listApplicationsService({ status, search, page = 1, limit = 10, createdFrom, createdTo, yearsMin, yearsMax, services }) {
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { "personal.fullName": { $regex: search, $options: "i" } },
      { "personal.email": { $regex: search, $options: "i" } },
      { "personal.phone": { $regex: search, $options: "i" } },
      { "vehicle.plate": { $regex: search, $options: "i" } },
    ];
  }
  // CreatedAt range filter
  if (createdFrom || createdTo) {
    query.createdAt = {};
    if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
    if (createdTo) query.createdAt.$lte = new Date(createdTo);
  }
  // Years of experience range
  if (typeof yearsMin !== "undefined" || typeof yearsMax !== "undefined") {
    query.yearsExperience = {};
    if (typeof yearsMin !== "undefined") query.yearsExperience.$gte = Number(yearsMin);
    if (typeof yearsMax !== "undefined") query.yearsExperience.$lte = Number(yearsMax);
  }
  // Services filter (CSV or array)
  if (services) {
    const svc = Array.isArray(services)
      ? services
      : String(services)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    if (svc.length) query.services = { $in: svc };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    DriverApplication.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    DriverApplication.countDocuments(query),
  ]);

  return { items, total, page: Number(page), limit: Number(limit) };
}

export async function getApplicationByIdService(id) {
  const app = await DriverApplication.findById(id);
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  return app;
}

export async function approveApplicationService(id) {
  const app = await DriverApplication.findById(id);
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "pending") {
    throw Object.assign(new Error("Chỉ duyệt hồ sơ ở trạng thái chờ duyệt"), { statusCode: 400 });
  }
  app.status = "approved";
  app.decidedAt = new Date();
  await app.save();

  // Ensure DriverProfile exists and is approved
  const profile = await DriverProfile.findOneAndUpdate(
    { userId: app.userId },
    { $set: { approved: true } },
    { upsert: true, new: true }
  );
  // Notify user
  try {
    const user = await User.findById(app.userId);
    if (user) {
      // Promote role to driver upon approval
      if (user.role !== "driver") {
        user.role = "driver";
        await user.save();
      }
      await notifyApplicationApproved(user.email, user.fullName);
    }
  } catch (e) {
    console.warn("notifyApplicationApproved error:", e?.message || e);
  }
  return { app, profile };
}

export async function rejectApplicationService(id, reason) {
  if (!reason) {
    throw Object.assign(new Error("Vui lòng cung cấp lý do từ chối"), { statusCode: 400 });
  }
  const app = await DriverApplication.findById(id);
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "pending") {
    throw Object.assign(new Error("Chỉ từ chối hồ sơ ở trạng thái chờ duyệt"), { statusCode: 400 });
  }
  app.status = "rejected";
  app.rejectionReason = reason;
  app.decidedAt = new Date();
  await app.save();

  await DriverProfile.findOneAndUpdate(
    { userId: app.userId },
    { $set: { approved: false, availability: "offline" } },
    { upsert: true, new: true }
  );
  // Notify user
  try {
    const user = await User.findById(app.userId);
    if (user) {
      await notifyApplicationRejected(user.email, user.fullName, reason);
    }
  } catch (e) {
    console.warn("notifyApplicationRejected error:", e?.message || e);
  }
  return app;
}

export async function setMyAvailabilityService(userId, online) {
  await ensureActiveUser(userId);
  const profile = await DriverProfile.findOne({ userId });
  if (!profile || !profile.approved) {
    throw Object.assign(new Error("Tài khoản chưa được duyệt làm tài xế"), { statusCode: 403 });
  }
  profile.availability = online ? "online" : "offline";
  await profile.save();
  return profile;
}

export async function updateMyApplicationService(userId, id, payload) {
  await ensureActiveUser(userId);
  const app = await DriverApplication.findOne({ _id: id, userId });
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "draft") {
    throw Object.assign(new Error("Chỉ cập nhật khi hồ sơ ở trạng thái nháp"), { statusCode: 400 });
  }
  app.personal = payload.personal ?? app.personal;
  app.vehicle = payload.vehicle ?? app.vehicle;
  if (payload.documents) app.documents = { ...app.documents, ...payload.documents };
  if (typeof payload.licenseNumber !== "undefined") app.licenseNumber = payload.licenseNumber;
  if (typeof payload.licenseExpiry !== "undefined") app.licenseExpiry = payload.licenseExpiry;
  if (typeof payload.yearsExperience !== "undefined") app.yearsExperience = payload.yearsExperience;
  if (Array.isArray(payload.services)) app.services = payload.services;
  await app.save();
  return app;
}

export async function deleteMyApplicationService(userId, id) {
  await ensureActiveUser(userId);
  const app = await DriverApplication.findOne({ _id: id, userId });
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "draft") {
    throw Object.assign(new Error("Chỉ xóa khi hồ sơ ở trạng thái nháp"), { statusCode: 400 });
  }
  await DriverApplication.deleteOne({ _id: id, userId });
  return { deleted: true };
}


