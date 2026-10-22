import SelfDriveBooking from "../models/SelfDriveBooking.js";
import SelfDriveDeposit from "../models/SelfDriveDeposit.js";
import DriverWallet from "../../../models/DriverWallet.js";
import DriverTransaction from "../../../models/DriverTransaction.js";
import { DEPOSIT_STATUS, PAYMENT_STATUS } from "../constants.js";
import { confirmRentalPayment } from "./bookingService.js";
import { notifyUsers } from "./notify.js";

const commissionRate = () => {
  const raw = process.env.BOOKING_COMMISSION_RATE;
  const percent = raw != null ? Number(raw) : 15;
  return Number.isNaN(percent) ? 0.15 : Math.min(Math.max(percent, 0), 100) / 100;
};

export const prepareSelfDrivePayment = async ({ purpose, referenceId, orderCode }) => {
  if (purpose === "self_drive") {
    const booking = await SelfDriveBooking.findOne({ bookingCode: referenceId });
    if (!booking) {
      throw Object.assign(new Error(`Không tìm thấy booking thuê xe ${referenceId}`), { statusCode: 404 });
    }
    booking.payment = booking.payment || {};
    booking.payment.orderCode = orderCode;
    booking.payment.createdAt = new Date();
    await booking.save();
    return { amountInt: Math.floor(Number(booking.totalAmount)), orderInfo: `self_drive:${referenceId}` };
  }
  if (purpose === "self_drive_deposit") {
    const booking = await SelfDriveBooking.findOne({ bookingCode: referenceId });
    if (!booking) {
      throw Object.assign(new Error(`Không tìm thấy booking ${referenceId}`), { statusCode: 404 });
    }
    const deposit = await SelfDriveDeposit.findOne({ bookingId: booking._id });
    if (!deposit) {
      throw Object.assign(new Error("Booking không có khoản cọc"), { statusCode: 404 });
    }
    deposit.payment = deposit.payment || {};
    deposit.payment.orderCode = orderCode;
    await deposit.save();
    return { amountInt: Math.floor(Number(deposit.amount)), orderInfo: `self_drive_deposit:${referenceId}` };
  }
  throw Object.assign(new Error("purpose không hợp lệ"), { statusCode: 400 });
};

export const attachSelfDriveCheckout = async ({ purpose, referenceId, paymentData, provider }) => {
  const booking = await SelfDriveBooking.findOne({ bookingCode: referenceId });
  if (!booking) return;
  if (purpose === "self_drive") {
    booking.payment = {
      ...(booking.payment?.toObject?.() || booking.payment || {}),
      ...paymentData,
      provider,
    };
    await booking.save();
    return;
  }
  if (purpose === "self_drive_deposit") {
    await SelfDriveDeposit.updateOne(
      { bookingId: booking._id },
      {
        $set: {
          "payment.orderCode": paymentData.orderCode,
          "payment.amount": paymentData.amount,
          "payment.checkoutUrl": paymentData.checkoutUrl,
          "payment.description": paymentData.description,
          "payment.provider": provider,
        },
      }
    );
  }
};

const creditOwner = async ({ ownerId, amount, note }) => {
  const wallet = await DriverWallet.findOne({ driver: ownerId });
  if (!wallet) {
    console.warn("[selfDrive] owner has no wallet, skip credit", String(ownerId));
    return;
  }
  const net = Math.round(Number(amount) * (1 - commissionRate()));
  const balanceBefore = wallet.balance;
  wallet.balance += net;
  wallet.totalEarnings += net;
  await wallet.save();
  await DriverTransaction.create({
    driver: ownerId,
    wallet: wallet._id,
    type: "self_drive_income",
    amount: net,
    balanceBefore,
    balanceAfter: wallet.balance,
    note,
  });
};

export const settleSelfDrivePayment = async ({ orderCode, amount, isSuccess }) => {
  const booking = await SelfDriveBooking.findOne({ "payment.orderCode": orderCode });
  if (booking) {
    const result = await confirmRentalPayment(booking, { amount, isSuccess });
    if (isSuccess && !result.duplicate) {
      await creditOwner({
        ownerId: booking.ownerId,
        amount,
        note: `Thu nhập thuê xe tự lái ${booking.bookingCode}`,
      });
    }
    const baseUrl = process.env.EXPO_REDIRECT_BASE;
    return {
      type: "self_drive",
      bookingCode: booking.bookingCode,
      status: result.booking.status,
      paymentStatus: result.booking.paymentStatus,
      amount,
      isSuccess,
      duplicate: result.duplicate,
      redirectUrl: isSuccess
        ? `${baseUrl}/--/self-drive-success?bookingCode=${booking.bookingCode}`
        : `${baseUrl}/--/self-drive-failed?bookingCode=${booking.bookingCode}`,
    };
  }

  const deposit = await SelfDriveDeposit.findOne({ "payment.orderCode": orderCode });
  if (deposit) {
    if (deposit.paymentStatus === PAYMENT_STATUS.PAID) {
      return { type: "self_drive_deposit", duplicate: true, isSuccess };
    }
    if (isSuccess) {
      deposit.paymentStatus = PAYMENT_STATUS.PAID;
      deposit.status = DEPOSIT_STATUS.HELD;
      deposit.payment = { ...(deposit.payment || {}), amount, paidAt: new Date() };
    } else {
      deposit.paymentStatus = PAYMENT_STATUS.FAILED;
    }
    await deposit.save();
    const related = await SelfDriveBooking.findById(deposit.bookingId);
    await notifyUsers({
      userIds: [deposit.customerId, deposit.ownerId],
      title: isSuccess ? "Đã giữ cọc thuê xe" : "Thanh toán cọc thất bại",
      message: related ? `Booking ${related.bookingCode}` : "Deposit",
      type: "payment",
      meta: { depositId: deposit._id },
    });
    return {
      type: "self_drive_deposit",
      bookingCode: related?.bookingCode,
      status: deposit.status,
      amount,
      isSuccess,
      duplicate: false,
    };
  }
  return null;
};
