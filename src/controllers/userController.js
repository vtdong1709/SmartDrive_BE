import {
  deleteUserService,
  getAllUsersService,
  getUserById,
  updateUserService,
} from "../services/userService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

/**
 * [User] Lấy thông tin cá nhân
 */
export const getMyProfile = async (req, res) => {
  try {
    // req.user được gán từ middleware authenticate
    const user = await getUserById(req.user.id);
    res.status(200).json(successResponse("Lấy thông tin thành công", user));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};

/**
 * [User] Cập nhật thông tin cá nhân
 */
export const updateUserProfile = async (req, res) => {
  try {
    // req.body sẽ chứa tất cả thông tin người dùng muốn cập nhật
    const user = await updateUserService(req.user.id, req.body);
    res.status(200).json(successResponse("Cập nhật thành công", user));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};

/**
 * [Admin] Lấy danh sách tất cả người dùng
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await getAllUsersService();
    res
      .status(200)
      .json(successResponse("Lấy danh sách người dùng thành công", users));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};

/**
 * [Admin] Lấy thông tin chi tiết một người dùng
 */
export const getUserDetails = async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    res
      .status(200)
      .json(successResponse("Lấy thông tin người dùng thành công", user));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};

/**
 * [Admin] Cập nhật thông tin người dùng
 */
export const updateUserByAdmin = async (req, res) => {
  try {
    const user = await updateUserService(req.params.id, req.body);
    res.status(200).json(successResponse("Cập nhật người dùng thành công", user));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};

/**
 * [Admin] Xóa người dùng
 */
export const deleteUser = async (req, res) => {
  try {
    await deleteUserService(req.params.id);
    res.status(200).json(successResponse("Xóa người dùng thành công"));
  } catch (error) {
    res
      .status(error.code || 500)
      .json(errorResponse(error.message, error.code));
  }
};