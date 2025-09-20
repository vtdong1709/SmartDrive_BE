import User from "../models/User.js";
import { errorResponse } from "../utils/apiResponse.js";

/**
 * Lấy thông tin người dùng bằng ID
 * @param {string} userId - ID của người dùng
 * @returns {Promise<User>}
 */
export const getUserById = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new errorResponse("Không tìm thấy người dùng", 404);
  }
  return user;
};

/**
 * Cập nhật thông tin người dùng
 * @param {string} userId - ID của người dùng cần cập nhật
 * @param {object} updateData - Dữ liệu cần cập nhật
 * @returns {Promise<User>}
 */
export const updateUserService = async (userId, updateData) => {
  const { fullName, phone, avatar } = updateData;

  // Chỉ cho phép cập nhật một số trường nhất định
  const allowedUpdates = { fullName, phone, avatar };

  const user = await User.findByIdAndUpdate(userId, allowedUpdates, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!user) {
    throw new errorResponse("Không tìm thấy người dùng", 404);
  }

  return user;
};

/**
 * Admin: Lấy danh sách tất cả người dùng
 * @returns {Promise<User[]>}
 */
export const getAllUsersService = async () => {
  const users = await User.find({}).select("-password");
  return users;
};

/**
 * Admin: Xóa người dùng
 * @param {string} userId - ID của người dùng cần xóa
 * @returns {Promise<boolean>}
 */
export const deleteUserService = async (userId) => {
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new errorResponse("Không tìm thấy người dùng", 404);
  }
  return true;
};