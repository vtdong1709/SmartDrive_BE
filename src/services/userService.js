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
  // Lấy ra các trường cho phép cập nhật từ body của request
  const {
    fullName,
    phone,
    avatar,
    dateOfBirth,
    gender,
    savedAddresses,
    paymentMethods,
  } = updateData;

  // Tạo object chứa các trường cần cập nhật
  const allowedUpdates = {
    fullName,
    phone,
    avatar,
    dateOfBirth,
    gender,
    savedAddresses,
    paymentMethods,
  };

  // Loại bỏ các trường undefined để không ghi đè dữ liệu không mong muốn
  Object.keys(allowedUpdates).forEach(
    (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
  );
  
  const user = await User.findByIdAndUpdate(userId, 
    { $set: allowedUpdates }, // Sử dụng $set để cập nhật các trường được cung cấp
    {
      new: true,
      runValidators: true,
      context: 'query'
    }
  ).select("-password");

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