import {
  requestDeleteAccountOTPService,
  confirmDeleteAccountService,
} from "../services/deleteAccountService.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";

/**
 * Gửi OTP qua email để xác thực xóa tài khoản
 */
export const requestDeleteAccountOTP = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await requestDeleteAccountOTPService(userId);

    res.status(200).json(successResponse(result.message));
  } catch (error) {
    console.error("Error in requestDeleteAccountOTP controller:", error);
    res.status(error.statusCode || 500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        error.statusCode || 500
      )
    );
  }
};

/**
 * Xác thực OTP và xóa tài khoản
 */
export const confirmDeleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otpCode } = req.body;

    if (!otpCode) {
      return res.status(400).json(
        errorResponse("Vui lòng cung cấp mã OTP", 400)
      );
    }

    const result = await confirmDeleteAccountService(userId, otpCode);

    res.status(200).json(
      successResponse(result.message, {
        deleted: true,
      })
    );
  } catch (error) {
    console.error("Error in confirmDeleteAccount controller:", error);
    res.status(error.statusCode || 500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        error.statusCode || 500
      )
    );
  }
};

