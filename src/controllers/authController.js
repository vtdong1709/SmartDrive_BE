import bcrypt from "bcrypt";
import {
  destroyRefreshTokenService,
  loginUser,
  refreshTokenService,
  registerUser,
} from "../services/authService.js";
import {
  generateAndSendOTPToEmailService,
  verifyOTPFromEmailService,
} from "../services/otpService.js";
import { sendWelcomeEmail } from "../services/mailService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

export const register = async (req, res) => {
  try {
    const userData = req.body;

    const newUser = await registerUser(userData);

    await generateAndSendOTPToEmailService(newUser.email, "verify_email");

    res.status(201).json(
      successResponse(
        "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
        {
          id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
        }
      )
    );
  } catch (error) {
    console.log(error.message);
    res
      .status(error.statusCode || 500)
      .json(
        errorResponse(
          error.statusCode && error.statusCode < 500
            ? error.message
            : "Có lỗi xảy ra, vui lòng thử lại sau",
          error.statusCode || 500
        )
      );
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res
        .status(400)
        .json(errorResponse("Vui lòng điền đầy đủ thông tin đăng nhập!", 400));
    }

    const { user, accessToken, refreshToken } = await loginUser({
      phone,
      password,
    });

    res.status(200).json(
      successResponse("Đăng nhập thành công", {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accessToken,
        refreshToken,
      })
    );
  } catch (error) {
    console.log(error.message);
    res
      .status(
        error.statusCode && error.statusCode < 500 ? error.statusCode : 500
      )
      .json(
        error.statusCode && error.statusCode < 500
          ? errorResponse(error.message, error.statusCode)
          : errorResponse("Có lỗi xảy ra, vui lòng thử lại sau", 500)
      );
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(errorResponse("Thiếu refresh token!", 400));
    }

    const { accessToken } = await refreshTokenService(refreshToken);

    res
      .status(200)
      .json(successResponse("Làm mới token thành công", { accessToken }));
  } catch (error) {
    console.log(error.message);
    res
      .status(
        error.statusCode && error.statusCode < 500 ? error.statusCode : 500
      )
      .json(
        error.statusCode && error.statusCode < 500
          ? errorResponse(error.message, error.statusCode)
          : errorResponse("Có lỗi xảy ra, vui lòng thử lại sau", 500)
      );
  }
};

export const destroyRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(errorResponse("Thiếu refresh token!", 400));
    }

    const result = await destroyRefreshTokenService(refreshToken);

    if (result === true) {
      return res
        .status(200)
        .json(successResponse("Xoá refresh token thành công!"));
    }

    return res
      .status(400)
      .json(errorResponse("Không thể xoá refresh token!", 400));
  } catch (error) {
    console.log(error.message);
    res
      .status(
        error.statusCode && error.statusCode < 500 ? error.statusCode : 500
      )
      .json(
        error.statusCode && error.statusCode < 500
          ? errorResponse(error.message, error.statusCode)
          : errorResponse("Có lỗi xảy ra, vui lòng thử lại sau", 500)
      );
  }
};

export const verifyEmailController = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await verifyOTPFromEmailService(email, code, "verify_email");
    user.verified = true;
    await user.save();
    
    // Gửi email chào mừng sau khi xác thực thành công
    await sendWelcomeEmail({ to: user.email, name: user.fullName });

    res
      .status(200)
      .json({ success: true, message: "Xác thực email thành công." });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

export const resetPasswordController = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!newPassword)
      throw Object.assign(new Error("Vui lòng cung cấp mật khẩu mới"), {
        statusCode: 400,
      });

    if (newPassword.length < 6)
      throw Object.assign(new Error("Mật khẩu phải có ít nhất 6 ký tự"), {
        statusCode: 400,
      });

    const user = await verifyOTPFromEmailService(email, code, "reset_password");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Đổi mật khẩu thành công." });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};

export const sendOTPToEmailController = async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email)
      throw Object.assign(new Error("Vui lòng cung cấp email"), {
        statusCode: 400,
      });
    if (!type)
      throw Object.assign(new Error("Vui lòng cung cấp loại OTP (type)"), {
        statusCode: 400,
      });

    const result = await generateAndSendOTPToEmailService(email, type);

    if (!result) {
      throw Object.assign(new Error("Gửi OTP thất bại, vui lòng thử lại"), {
        statusCode: 500,
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP đã được gửi thành công.",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Có lỗi xảy ra, vui lòng thử lại sau",
    });
  }
};
