import DriverApplication from "../../../models/DriverApplication.js";
import { httpError } from "../httpError.js";

export const inspectCustomerKyc = async (user) => {
  const phoneVerified = Boolean(user.phone);
  const identityVerified = Boolean(user.verified);
  const app = await DriverApplication.findOne({
    userId: user._id,
    status: "approved",
  }).sort({ decidedAt: -1 });

  const licenseVerified = Boolean(
    app?.licenseNumber &&
      app?.documents?.driverLicenseFrontUrl &&
      app?.documents?.driverLicenseBackUrl
  );

  return {
    phoneVerified,
    identityVerified,
    licenseVerified,
    hasApprovedApplication: Boolean(app),
  };
};

export const assertCustomerEligible = async (user) => {
  const requireLicense = process.env.SELF_DRIVE_REQUIRE_LICENSE !== "false";
  const kyc = await inspectCustomerKyc(user);
  if (!kyc.identityVerified) {
    throw httpError("Tài khoản chưa xác thực (KYC/email). Vui lòng xác thực trước khi thuê xe.", 403);
  }
  if (!kyc.phoneVerified) {
    throw httpError("Cần có số điện thoại trên hồ sơ để thuê xe tự lái.", 403);
  }
  if (requireLicense && !kyc.licenseVerified) {
    throw httpError(
      "Cần giấy phép lái xe đã được duyệt (hồ sơ tài xế approved) để thuê xe tự lái.",
      403
    );
  }
  return kyc;
};

export const publicKycSummary = (kyc) => ({
  phoneVerified: kyc.phoneVerified,
  identityVerified: kyc.identityVerified,
  licenseVerified: kyc.licenseVerified,
});
