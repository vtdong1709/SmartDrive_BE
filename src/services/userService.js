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

/**
 * Link Telegram account bằng telegramId
 * Tìm user bằng telegramId hoặc userId, sau đó cập nhật thông tin Telegram
 * @param {object} data - { telegramId, chatId, username, userId? }
 * @returns {Promise<User>}
 */
export const linkTelegramAccountService = async (data) => {
  const { telegramId, chatId, username, userId } = data;

  if (!telegramId || !chatId) {
    throw Object.assign(new Error("Thiếu telegramId hoặc chatId"), {
      statusCode: 400,
    });
  }

  let user;

  // Nếu có userId, tìm user bằng userId
  if (userId) {
    user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }
  } else {
    // Nếu không có userId, tìm user bằng telegramId
    user = await User.findOne({ telegramId });
    
    // Nếu không tìm thấy, tìm user có telegramChatId trùng với chatId
    if (!user) {
      user = await User.findOne({ telegramChatId: chatId });
    }
  }

  // Nếu vẫn không tìm thấy user, có thể tạo mới hoặc báo lỗi
  // Ở đây tôi sẽ báo lỗi vì cần user đã tồn tại trong hệ thống
  if (!user) {
    throw Object.assign(
      new Error(
        "Không tìm thấy người dùng. Vui lòng đăng nhập vào ứng dụng trước."
      ),
      { statusCode: 404 }
    );
  }

  // Cập nhật thông tin Telegram
  user.telegramId = telegramId;
  user.telegramChatId = chatId;
  if (username) {
    user.telegramUsername = username;
  }

  await user.save();

  return user;
};