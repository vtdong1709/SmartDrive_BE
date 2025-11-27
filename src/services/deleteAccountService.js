import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import OTP from "../models/OTP.js";
import Notification from "../models/Notification.js";
import DriverApplication from "../models/DriverApplication.js";
import DriverProfile from "../models/DriverProfile.js";
import DriverWallet from "../models/DriverWallet.js";
import Booking from "../models/Booking.js";
import ChatMessage from "../models/ChatMessage.js";
import WithdrawRequest from "../models/WithdrawRequest.js";
import { generateAndSendOTPToEmailService } from "./otpService.js";
import { verifyOTPFromEmailService } from "./otpService.js";

/**
 * Tạo email và phone anonymized
 */
const generateAnonymizedEmail = (userId) => {
  return `deleted_${userId}_${Date.now()}@deleted.local`;
};

const generateAnonymizedPhone = () => {
  return `0000000000`;
};

/**
 * Gửi OTP qua email để xác thực xóa tài khoản
 */
export const requestDeleteAccountOTPService = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    // Kiểm tra nếu đã bị xóa rồi
    if (user.email && user.email.includes("@deleted.local")) {
      throw Object.assign(new Error("Tài khoản đã bị xóa"), {
        statusCode: 400,
      });
    }

    // Kiểm tra email đã verified chưa
    if (!user.verified) {
      throw Object.assign(
        new Error("Tài khoản chưa được xác thực email. Vui lòng xác thực email trước."),
        { statusCode: 403 }
      );
    }

    // Gửi OTP qua email
    await generateAndSendOTPToEmailService(user.email, "delete_account");

    return {
      success: true,
      message: "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.",
    };
  } catch (error) {
    console.error("Error requesting delete account OTP:", error);
    throw error;
  }
};

/**
 * Xác thực OTP và xóa tài khoản - Anonymize dữ liệu nhạy cảm
 * Giữ lại ID và các quan hệ để giữ tính toàn vẹn database
 */
export const confirmDeleteAccountService = async (userId, otpCode) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    // Kiểm tra nếu đã bị xóa rồi
    if (user.email && user.email.includes("@deleted.local")) {
      throw Object.assign(new Error("Tài khoản đã bị xóa"), {
        statusCode: 400,
      });
    }

    // Xác thực OTP
    await verifyOTPFromEmailService(user.email, otpCode, "delete_account");

    // Nếu OTP hợp lệ, thực hiện xóa tài khoản
    return await deleteAccountService(userId);
  } catch (error) {
    console.error("Error confirming delete account:", error);
    throw error;
  }
};

/**
 * Xóa tài khoản - Anonymize dữ liệu nhạy cảm
 * Giữ lại ID và các quan hệ để giữ tính toàn vẹn database
 */
const deleteAccountService = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw Object.assign(new Error("Không tìm thấy người dùng"), {
        statusCode: 404,
      });
    }

    // Kiểm tra nếu đã bị xóa rồi
    if (user.email && user.email.includes("@deleted.local")) {
      throw Object.assign(new Error("Tài khoản đã bị xóa"), {
        statusCode: 400,
      });
    }

    // 1. Xóa/anonymize dữ liệu nhạy cảm trong User
    const anonymizedEmail = generateAnonymizedEmail(userId);
    const anonymizedPhone = generateAnonymizedPhone();
    
    await User.findByIdAndUpdate(userId, {
      $set: {
        fullName: "Người dùng đã xóa",
        email: anonymizedEmail,
        phone: anonymizedPhone,
        avatar: null,
        dateOfBirth: null,
        gender: null,
        savedAddresses: [],
        verified: false,
        // Giữ lại: _id, role, password (đã hash), timestamps, driverProfileId
      },
    });

    // 2. Xóa tất cả RefreshToken
    await RefreshToken.deleteMany({ userId });

    // 3. Xóa tất cả OTP
    await OTP.deleteMany({ userId });

    // 4. Xóa tất cả Notifications
    await Notification.deleteMany({ userId });

    // 5. Anonymize DriverApplication nếu có
    const driverApplications = await DriverApplication.find({ userId });
    for (const app of driverApplications) {
      if (app.personal) {
        app.personal.fullName = "Đã xóa";
        app.personal.phone = anonymizedPhone;
        app.personal.email = anonymizedEmail;
        app.personal.idNumber = null;
      }
      if (app.address) {
        app.address.province = null;
        app.address.district = null;
        app.address.ward = null;
        app.address.specificAddress = null;
      }
      if (app.documents) {
        app.documents.idFrontUrl = null;
        app.documents.idBackUrl = null;
        app.documents.driverLicenseFrontUrl = null;
        app.documents.driverLicenseBackUrl = null;
      }
      app.licenseNumber = null;
      await app.save();
    }

    // 6. Xóa/anonymize DriverProfile nếu có
    const driverProfile = await DriverProfile.findOne({ userId });
    if (driverProfile) {
      // Có thể xóa hoặc anonymize, tùy yêu cầu
      // Ở đây giữ lại để giữ tính toàn vẹn database
      driverProfile.availability = "offline";
      await driverProfile.save();
    }

    // 7. Xóa/anonymize DriverWallet nếu có
    const driverWallet = await DriverWallet.findOne({ driver: userId });
    if (driverWallet) {
      // Giữ lại wallet để giữ tính toàn vẹn, nhưng có thể lock
      driverWallet.isLocked = true;
      driverWallet.lockReason = "Tài khoản đã bị xóa";
      if (driverWallet.bankAccount) {
        driverWallet.bankAccount.numberBank = null;
        driverWallet.bankAccount.bankName = null;
      }
      await driverWallet.save();
    }

    // 8. Anonymize ChatMessage - xóa nội dung tin nhắn nhưng giữ lại structure
    await ChatMessage.updateMany(
      { $or: [{ senderId: userId }, { receiverId: userId }] },
      {
        $set: {
          message: "[Tin nhắn đã bị xóa]",
        },
      }
    );

    // 9. Anonymize WithdrawRequest nếu có
    const withdrawRequests = await WithdrawRequest.find({ driver: userId });
    for (const request of withdrawRequests) {
      if (request.bankInfo) {
        request.bankInfo.accountNumber = null;
        request.bankInfo.accountName = null;
        request.bankInfo.bankName = null;
      }
      await request.save();
    }

    // 10. Booking và các dữ liệu khác giữ nguyên vì cần cho lịch sử giao dịch
    // Chỉ anonymize thông tin trong populate, không xóa booking
    // DriverTransaction giữ nguyên để giữ tính toàn vẹn

    console.log(`Account ${userId} has been deleted and anonymized`);

    return {
      success: true,
      message: "Tài khoản đã được xóa thành công. Tất cả dữ liệu nhạy cảm đã bị xóa hoặc ẩn.",
    };
  } catch (error) {
    console.error("Error deleting account:", error);
    throw error;
  }
};

