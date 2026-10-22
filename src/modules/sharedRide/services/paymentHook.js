import SharedRideBooking from "../models/SharedRideBooking.js";
import SharedRideCharter from "../models/SharedRideCharter.js";
import DriverWallet from "../../../models/DriverWallet.js";
import DriverTransaction from "../../../models/DriverTransaction.js";
import { getIO } from "../../../socket.js";
import { confirmSharedRideBookingPayment } from "./bookingService.js";
import { confirmCharterPayment } from "./charterService.js";

const commissionRate = () => {
  const raw = process.env.BOOKING_COMMISSION_RATE;
  const percent = raw != null ? Number(raw) : 15;
  if (Number.isNaN(percent)) return 0.15;
  return Math.min(Math.max(percent, 0), 100) / 100;
};

export const prepareSharedRidePayment = async ({ purpose, referenceId, orderCode }) => {
  if (purpose === "shared_ride") {
    const booking = await SharedRideBooking.findOne({ bookingCode: referenceId });
    if (!booking) {
      throw Object.assign(new Error(`Không tìm thấy booking xe ghép ${referenceId}`), { statusCode: 404 });
    }
    booking.payment = booking.payment || {};
    booking.payment.orderCode = orderCode;
    booking.payment.createdAt = new Date();
    await booking.save();
    return {
      amountInt: Math.floor(Number(booking.totalAmount)),
      orderInfo: `shared_ride:${referenceId}`,
    };
  }

  if (purpose === "shared_ride_charter") {
    const charter = await SharedRideCharter.findOne({ charterCode: referenceId });
    if (!charter) {
      throw Object.assign(new Error(`Không tìm thấy yêu cầu bao xe ${referenceId}`), { statusCode: 404 });
    }
    if (!["ACCEPTED", "AWAITING_PAYMENT"].includes(charter.status)) {
      throw Object.assign(new Error("Yêu cầu bao xe chưa được tài xế chấp nhận"), { statusCode: 400 });
    }
    charter.payment = charter.payment || {};
    charter.payment.orderCode = orderCode;
    charter.payment.createdAt = new Date();
    charter.status = "AWAITING_PAYMENT";
    await charter.save();
    return {
      amountInt: Math.floor(Number(charter.quotedPrice)),
      orderInfo: `shared_ride_charter:${referenceId}`,
    };
  }

  throw Object.assign(new Error("purpose không hợp lệ"), { statusCode: 400 });
};

export const attachSharedRideCheckout = async ({ purpose, referenceId, paymentData, provider }) => {
  if (purpose === "shared_ride") {
    await SharedRideBooking.updateOne(
      { bookingCode: referenceId },
      {
        $set: {
          "payment.orderCode": paymentData.orderCode,
          "payment.amount": paymentData.amount,
          "payment.checkoutUrl": paymentData.checkoutUrl,
          "payment.qrCode": paymentData.qrCode,
          "payment.description": paymentData.description,
          "payment.provider": provider,
          "payment.createdAt": new Date(),
        },
      }
    );
    return;
  }
  if (purpose === "shared_ride_charter") {
    await SharedRideCharter.updateOne(
      { charterCode: referenceId },
      {
        $set: {
          "payment.orderCode": paymentData.orderCode,
          "payment.amount": paymentData.amount,
          "payment.checkoutUrl": paymentData.checkoutUrl,
          "payment.qrCode": paymentData.qrCode,
          "payment.description": paymentData.description,
          "payment.provider": provider,
          "payment.createdAt": new Date(),
        },
      }
    );
  }
};

const creditDriver = async ({ driverId, amount, note, bookingId }) => {
  const wallet = await DriverWallet.findOne({ driver: driverId });
  if (!wallet) {
    console.warn("[sharedRide] no driver wallet, skip credit", String(driverId));
    return;
  }
  const net = Math.round(Number(amount) * (1 - commissionRate()));
  const balanceBefore = wallet.balance;
  wallet.balance += net;
  wallet.totalEarnings += net;
  await wallet.save();
  await DriverTransaction.create({
    driver: driverId,
    wallet: wallet._id,
    booking: bookingId || null,
    type: "shared_ride_income",
    amount: net,
    balanceBefore,
    balanceAfter: wallet.balance,
    note,
  });
  try {
    const io = getIO();
    io.emit("walletUpdated", {
      type: "shared_ride_income",
      driverWalletId: wallet._id,
      balance: wallet.balance,
      addedAmount: net,
      message: note,
    });
  } catch {
    /* socket may be unavailable in tests */
  }
};

export const settleSharedRidePayment = async ({ orderCode, amount, isSuccess }) => {
  const booking = await SharedRideBooking.findOne({ "payment.orderCode": orderCode });
  if (booking) {
    const result = await confirmSharedRideBookingPayment(booking, { amount, isSuccess });
    if (isSuccess && !result.duplicate) {
      await creditDriver({
        driverId: booking.driverId,
        amount,
        note: `Thu nhập xe ghép ${booking.bookingCode}`,
        bookingId: null,
      });
    }
    const baseUrl = process.env.EXPO_REDIRECT_BASE;
    return {
      type: "shared_ride",
      bookingCode: booking.bookingCode,
      status: result.booking.status,
      paymentStatus: result.booking.paymentStatus,
      amount,
      isSuccess,
      duplicate: result.duplicate,
      redirectUrl: isSuccess
        ? `${baseUrl}/--/shared-ride-success?bookingCode=${booking.bookingCode}`
        : `${baseUrl}/--/shared-ride-failed?bookingCode=${booking.bookingCode}`,
    };
  }

  const charter = await SharedRideCharter.findOne({ "payment.orderCode": orderCode });
  if (charter) {
    const result = await confirmCharterPayment(charter, { amount, isSuccess });
    if (isSuccess && !result.duplicate) {
      await creditDriver({
        driverId: charter.driverId,
        amount,
        note: `Thu nhập bao xe ${charter.charterCode}`,
      });
    }
    const baseUrl = process.env.EXPO_REDIRECT_BASE;
    return {
      type: "shared_ride_charter",
      charterCode: charter.charterCode,
      status: result.charter.status,
      paymentStatus: result.charter.paymentStatus,
      amount,
      isSuccess,
      duplicate: result.duplicate,
      redirectUrl: isSuccess
        ? `${baseUrl}/--/shared-ride-charter-success?charterCode=${charter.charterCode}`
        : `${baseUrl}/--/shared-ride-charter-failed?charterCode=${charter.charterCode}`,
    };
  }

  return null;
};
