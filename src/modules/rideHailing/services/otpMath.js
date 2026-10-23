import bcrypt from "bcrypt";
import crypto from "crypto";
import { ERROR_CODE, getOtpTtlMinutes } from "../constants.js";
import { httpError } from "../httpError.js";

export const generateRideOtp = () => String(crypto.randomInt(100000, 999999));

export const hashRideOtp = async (otp) => bcrypt.hash(String(otp), 10);

export const otpExpiry = (now = Date.now(), ttlMinutes = getOtpTtlMinutes()) =>
  new Date(now + ttlMinutes * 60 * 1000);

export const isOtpExpired = (expiresAt, now = new Date()) => !expiresAt || new Date(expiresAt) <= now;

export const verifyRideOtp = async ({ otp, otpHash, otpExpiresAt, now = new Date() }) => {
  if (isOtpExpired(otpExpiresAt, now) || !otpHash) {
    throw httpError("OTP đã hết hạn", 400, ERROR_CODE.OTP_EXPIRED);
  }
  const ok = await bcrypt.compare(String(otp || ""), otpHash);
  if (!ok) throw httpError("OTP không đúng", 400, ERROR_CODE.INVALID_OTP);
  return true;
};

export const isOfferExpired = (offer, now = new Date()) =>
  !offer || offer.status !== "PENDING" || new Date(offer.expiresAt) <= now;
