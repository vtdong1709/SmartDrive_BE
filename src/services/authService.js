import bcrypt from "bcrypt";
import User from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwtHandler.js";
import RefreshToken from "../models/RefreshToken.js";

export const registerUser = async (userData) => {
  const { fullName, email, phone, password, role } = userData;

  if (!fullName)
    throw Object.assign(new Error("Vui lòng cung cấp họ và tên"), {
      statusCode: 400,
    });
  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });
  if (!password)
    throw Object.assign(new Error("Vui lòng cung cấp mật khẩu"), {
      statusCode: 400,
    });
  if (password.length < 6)
    throw Object.assign(new Error("Mật khẩu phải có ít nhất 6 ký tự"), {
      statusCode: 400,
    });

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error("Email đã tồn tại");
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({
    fullName,
    email,
    phone: phone || null,
    password: hashedPassword,
    role: role || "renter",
    verified: false,
    avatar: null,
    idDocument: null, 
  });

  await newUser.save();
  return newUser;
};

export const loginUser = async (loginData) => {
  const { email, password } = loginData;

  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });
  if (!password)
    throw Object.assign(new Error("Vui lòng cung cấp mật khẩu"), {
      statusCode: 400,
    });

  const user = await User.findOne({ email });
  if (!user)
    throw Object.assign(new Error("Sai email hoặc mật khẩu!"), {
      statusCode: 400,
    });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    throw Object.assign(new Error("Sai email hoặc mật khẩu!"), {
      statusCode: 400,
    });

  if (!user.verified) {
    throw Object.assign(
      new Error(
        "Tài khoản chưa được xác thực email. Vui lòng kiểm tra hộp thư."
      ),
      { statusCode: 403 }
    );
  }

  const accessToken = generateAccessToken(user);
  const refreshTokenValue = generateRefreshToken(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    token: refreshTokenValue,
    expiresAt,
  });

  return { user, accessToken, refreshToken: refreshTokenValue };
};

export const refreshTokenService = async (refreshTokenValue) => {
  if (!refreshTokenValue) {
    throw Object.assign(new Error("Thiếu refresh token!"), { statusCode: 400 });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshTokenValue);
  } catch {
    throw Object.assign(new Error("Refresh token không hợp lệ!"), {
      statusCode: 400,
    });
  }

  const tokenRecord = await RefreshToken.findOne({ token: refreshTokenValue });
  if (!tokenRecord) {
    throw Object.assign(
      new Error("Refresh token không hợp lệ hoặc đã hết hạn!"),
      { statusCode: 400 }
    );
  }

  const user = await User.findById(decoded.id);
  if (!user)
    throw Object.assign(new Error("Người dùng không tồn tại!"), {
      statusCode: 400,
    });

  const newAccessToken = generateAccessToken(user);
  return { accessToken: newAccessToken };
};

export const destroyRefreshTokenService = async (refreshTokenValue) => {
  if (!refreshTokenValue)
    throw Object.assign(new Error("Thiếu refresh token!"), { statusCode: 400 });

  const result = await RefreshToken.deleteOne({ token: refreshTokenValue });
  if (result.deletedCount === 0) {
    throw Object.assign(
      new Error("Refresh token không hợp lệ hoặc đã bị xoá!"),
      { statusCode: 400 }
    );
  }
  return true;
};

export const requestResetPasswordService = async (email) => {
  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });

  const user = await User.findOne({ email });
  if (!user)
    throw Object.assign(new Error("Email không tồn tại"), { statusCode: 404 });

  await OTP.deleteMany({ userId: user._id, type: "reset_password" });

  await generateAndSendOTP(user, "reset_password");

  return true;
};

export const confirmResetPasswordService = async (email, code, newPassword) => {
  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });
  if (!code)
    throw Object.assign(new Error("Vui lòng cung cấp OTP"), {
      statusCode: 400,
    });
  if (!newPassword)
    throw Object.assign(new Error("Vui lòng cung cấp mật khẩu mới"), {
      statusCode: 400,
    });
  if (newPassword.length < 6)
    throw Object.assign(new Error("Mật khẩu phải có ít nhất 6 ký tự"), {
      statusCode: 400,
    });

  const user = await User.findOne({ email });
  if (!user)
    throw Object.assign(new Error("Email không tồn tại"), { statusCode: 400 });

  const otpEntry = await OTP.findOne({
    userId: user._id,
    type: "reset_password",
  }).sort({ createdAt: -1 });
  if (!otpEntry)
    throw Object.assign(new Error("OTP không hợp lệ hoặc đã hết hạn"), {
      statusCode: 400,
    });

  if (otpEntry.attempts >= 3)
    throw Object.assign(new Error("Bạn đã vượt quá số lần thử tối đa"), {
      statusCode: 400,
    });

  if (otpEntry.code !== code) {
    otpEntry.attempts += 1;
    await otpEntry.save();
    throw Object.assign(new Error("OTP không đúng"), { statusCode: 400 });
  }

  await otpEntry.deleteOne();

  //Change new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  await User.findByIdAndUpdate(user._id, { password: hashedPassword });

  return true;
};
