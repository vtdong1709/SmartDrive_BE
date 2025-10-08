// Driver role-only services should remain here. Application-related logic has
// been moved to driverApplicationService.js

import DriverProfile from "../models/DriverProfile.js";
import User from "../models/User.js";

async function ensureDriver(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error("Không tìm thấy người dùng"), { statusCode: 404 });
  }
  if (user.role !== "driver") {
    throw Object.assign(new Error("Chỉ dành cho tài xế"), { statusCode: 403 });
  }
  return user;
}

export async function getMyDriverProfileService(userId) {
  await ensureDriver(userId);
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ tài xế"), { statusCode: 404 });
  }
  return profile;
}

export async function updateMyDriverProfileService(userId, payload) {
  await ensureDriver(userId);
  const allowed = {};
  if (typeof payload.availability !== "undefined") {
    allowed.availability = payload.availability;
  }
  if (typeof payload.location !== "undefined") {
    allowed.location = payload.location;
  }
  const profile = await DriverProfile.findOneAndUpdate(
    { userId },
    { $set: allowed },
    { new: true }
  );
  if (!profile) {
    throw Object.assign(new Error("Không tìm thấy hồ sơ tài xế"), { statusCode: 404 });
  }
  return profile;
}



