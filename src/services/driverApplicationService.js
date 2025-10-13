import redis from "../redis.js";
import DriverApplication from "../models/DriverApplication.js";
import DriverProfile from "../models/DriverProfile.js";
import User from "../models/User.js";
import {
  notifyApplicationApproved,
  notifyApplicationRejected,
  notifyApplicationSubmitted,
} from "./notificationService.js";

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

export async function getMyApplicationService(userId) {
  await ensureActiveUser(userId);
  const apps = await DriverApplication.find({ userId }).sort({ createdAt: -1 });
  return apps;
}

export async function upsertDraftApplicationService(userId, payload) {
  await ensureActiveUser(userId);
  if (payload?.applicationId) {
    const app = await DriverApplication.findOne({ _id: payload.applicationId, userId });
    if (!app) {
      throw Object.assign(new Error("Không tìm thấy hồ sơ để cập nhật"), { statusCode: 404 });
    }
    if (app.status !== "draft" && app.status !== "rejected") {
      throw Object.assign(new Error("Chỉ cập nhật khi hồ sơ ở trạng thái nháp/bị từ chối"), { statusCode: 400 });
    }
    app.personal = payload.personal ?? app.personal;
    app.address = payload.address ?? app.address;
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

  const created = await DriverApplication.create({
    userId,
    status: "draft",
    personal: payload.personal,
    address: payload.address,
    documents: payload.documents || {},
    licenseNumber: payload.licenseNumber,
    licenseExpiry: payload.licenseExpiry,
    yearsExperience: payload.yearsExperience,
    services: payload.services || [],
  });
  return { app: created, isNew: true };
}

export async function submitApplicationService(userId, applicationId) {
  const user = await ensureActiveUser(userId);
  const app = await DriverApplication.findOne({ _id: applicationId, userId });
  if (!app) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ"), { statusCode: 404 });
  }
  if (app.status !== "draft") {
    throw Object.assign(new Error("Chỉ có thể gửi hồ sơ ở trạng thái nháp"), { statusCode: 400 });
  }
  const docs = app.documents || {};
  const requiredDocFields = ["idFrontUrl", "idBackUrl", "driverLicenseFrontUrl", "driverLicenseBackUrl"];
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
  try {
    await notifyApplicationSubmitted(user.email, user.fullName);
  } catch (e) {
    console.warn("notifyApplicationSubmitted error:", e?.message || e);
  }
  await app.save();
  try {
    // Gửi thông báo
    await createAndSendNotification(
      user._id,
      "Hồ sơ đã được gửi",
      "Hồ sơ tài xế của bạn đã được gửi và đang chờ xét duyệt.",
      "driver_pending",
      {
        to: user.email,
        subject: "SmartDrive - Đã nhận hồ sơ tài xế",
        body: `Xin chào <strong>${user.fullName}</strong>,<br/>Chúng tôi đã nhận được hồ sơ tài xế của bạn và sẽ xem xét trong 1–3 ngày làm việc.`
      }
    );
  } catch (e) {
    console.warn("submitApplication notification error:", e?.message || e);
  }

  return app;
}

export async function listApplicationsService({ status, search, page = 1, limit = 10, createdFrom, createdTo, yearsMin, yearsMax, services }) {
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { "personal.fullName": { $regex: search, $options: "i" } },
      { "personal.email": { $regex: search, $options: "i" } },
      { "personal.phone": { $regex: search, $options: "i" } },
    ];
  }
  if (createdFrom || createdTo) {
    query.createdAt = {};
    if (createdFrom) query.createdAt.$gte = new Date(createdFrom);
    if (createdTo) query.createdAt.$lte = new Date(createdTo);
  }
  if (typeof yearsMin !== "undefined" || typeof yearsMax !== "undefined") {
    query.yearsExperience = {};
    if (typeof yearsMin !== "undefined") query.yearsExperience.$gte = Number(yearsMin);
    if (typeof yearsMax !== "undefined") query.yearsExperience.$lte = Number(yearsMax);
  }
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

export async function getApplicationByDriverIdService(driverId) {
  const app = await DriverApplication.findOne({ userId: driverId });
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
  const profile = await DriverProfile.findOneAndUpdate(
    { userId: app.userId },
    { $set: { approved: true } },
    { upsert: true, new: true }
  );
  try {
    const user = await User.findById(app.userId);
    if (user) {
      if (user.role !== "driver") {
        user.role = "driver";
        await user.save();
        await createAndSendNotification(
          user._id,
          "Hồ sơ được duyệt",
          "Chúc mừng! Hồ sơ tài xế của bạn đã được duyệt.",
          "driver_approved",
          {
            to: user.email,
            subject: "SmartDrive - Hồ sơ đã được duyệt",
            body: `Xin chào <strong>${user.fullName}</strong>,<br/>Hồ sơ của bạn đã được duyệt. Vui lòng đăng nhập để bật trạng thái sẵn sàng.`
          }
        );
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
  try {
    const user = await User.findById(app.userId);
    if (user) {
      await createAndSendNotification(
        user._id,
        "Hồ sơ bị từ chối",
        `Hồ sơ của bạn đã bị từ chối với lý do: ${reason}`,
        "driver_rejected",
        {
          to: user.email,
          subject: "SmartDrive - Hồ sơ bị từ chối",
          body: `Xin chào <strong>${user.fullName}</strong>,<br/>Rất tiếc hồ sơ của bạn bị từ chối với lý do: ${reason}. Bạn có thể bổ sung và gửi lại.`
        }
      );
    }
  } catch (e) {
    console.warn("notifyApplicationRejected error:", e?.message || e);
  }
  return app;
}

export async function setMyAvailabilityService(userId, online) {
  await ensureActiveUser(userId);
  const profile = await DriverProfile.findOne({ userId });
  console.log("profile", profile)
  if (!profile || !profile.approved) {
    throw Object.assign(new Error("Tài khoản chưa được duyệt làm tài xế"), { statusCode: 403 });
  }
  profile.availability = online ? "online" : "offline";
  await profile.save();
   // Nếu tắt, xóa khỏi Redis luôn
   if (online) {
    await redis.set(
      `driver:${userId}`,
      JSON.stringify({
        availability: "online",
        lastSeen: Date.now(),
      })
    );
  } else {
    await redis.del(`driver:${userId}`);
  }
  return profile;
}

//Cập nhật vị trí realtime của tài xế (gọi từ socket)
export async function updateDriverLocation(driverId, lat, lng) {
  const payload = JSON.stringify({
    lat,
    lng,
    lastSeen: Date.now(),
  });

  // TTL = 30 giây → nếu không cập nhật lại => tự mất
  await redis.set(`driver:${driverId}`, payload, "EX", 30);
}

//Lấy số lượng tài xế online hiện tại
export async function getOnlineDriverCount() {
  const keys = await redis.keys("driver:*");
  return keys.length;
}

export async function getAllOnlineDrivers() {
  const keys = await redis.keys("driver:*");
  const drivers = [];

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const driverId = key.split(":")[1];
      drivers.push({ driverId, ...JSON.parse(data) });
    }
  }

  return drivers;
}

//Lấy danh sách tài xế online và vị trí (để tìm tài xế gần khách)
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
  app.address = payload.address ?? app.address;
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






