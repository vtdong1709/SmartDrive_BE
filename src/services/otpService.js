import OTP from "../models/OTP.js";
import User from "../models/User.js";
import { sendOtpEmail } from "./mailService.js";
import bcrypt from "bcrypt";

const OTP_EXPIRATION = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const VALID_TYPES = ["verify_email", "reset_password"];

export const generateAndSendOTPToEmailService = async (email, type) => {
  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });

  if (!type)
    throw Object.assign(new Error("Vui lòng cung cấp loại OTP (type)"), {
      statusCode: 400,
    });

  if (!VALID_TYPES.includes(type)) {
    throw Object.assign(
      new Error(`Type không hợp lệ. Chỉ được: ${VALID_TYPES.join(", ")}`),
      { statusCode: 400 }
    );
  }

  const user = await User.findOne({ email });
  if (!user)
    throw Object.assign(new Error("Người dùng không tồn tại"), {
      statusCode: 400,
    });

  if (type === "reset_password" && !user.verified) {
    throw Object.assign(
      new Error(
        "Tài khoản chưa được xác thực. Không thể gửi mã đặt lại mật khẩu."
      ),
      { statusCode: 403 }
    );
  }

  await OTP.deleteMany({ userId: user._id, type });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION);

  await OTP.create({ userId: user._id, code: hashedCode, type, expiresAt });

  try {
    await sendOtpEmail({
      to: email,
      name: user.fullName,
      otpCode: code,
      type,
    });
  } catch (error) {
    await OTP.deleteMany({ userId: user._id, type });
    throw Object.assign(new Error("Gửi OTP thất bại, vui lòng thử lại"), {
      statusCode: 500,
    });
  }

  return true;
};

export const verifyOTPFromEmailService = async (email, code, type) => {
  if (!email)
    throw Object.assign(new Error("Vui lòng cung cấp email"), {
      statusCode: 400,
    });

  if (!code)
    throw Object.assign(new Error("Vui lòng cung cấp OTP"), {
      statusCode: 400,
    });

  if (!type)
    throw Object.assign(new Error("Vui lòng cung cấp loại OTP (type)"), {
      statusCode: 400,
    });

  if (!VALID_TYPES.includes(type)) {
    throw Object.assign(
      new Error(`Type không hợp lệ. Chỉ được: ${VALID_TYPES.join(", ")}`),
      { statusCode: 400 }
    );
  }

  const user = await User.findOne({ email });
  if (!user)
    throw Object.assign(new Error("Người dùng không tồn tại"), {
      statusCode: 400,
    });

  const otpEntry = await OTP.findOne({ userId: user._id, type }).sort({
    createdAt: -1,
  });
  if (!otpEntry)
    throw Object.assign(new Error("OTP không tồn tại"), { statusCode: 400 });

  if (otpEntry.attempts >= MAX_ATTEMPTS)
    throw Object.assign(new Error("Bạn đã vượt quá số lần thử tối đa"), {
      statusCode: 400,
    });

  if (otpEntry.expiresAt < new Date())
    throw Object.assign(new Error("OTP đã hết hạn"), { statusCode: 400 });

  const isValid = await bcrypt.compare(code, otpEntry.code);
  if (!isValid) {
    otpEntry.attempts += 1;
    await otpEntry.save();
    throw Object.assign(new Error("OTP không đúng"), { statusCode: 400 });
  }

  await otpEntry.deleteOne();
  return user;
};
