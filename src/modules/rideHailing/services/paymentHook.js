import RideBooking from "../models/RideBooking.js";
import DriverWallet from "../../../models/DriverWallet.js";
import DriverTransaction from "../../../models/DriverTransaction.js";
import { getCommissionRate } from "../constants.js";
import { confirmRidePayment } from "./bookingService.js";
import { notifyUsers } from "./notify.js";

export const prepareRideHailingPayment = async ({ purpose, referenceId, orderCode }) => {
  if (purpose !== "ride_hailing") {
    throw Object.assign(new Error("purpose không hợp lệ"), { statusCode: 400 });
  }
  const ride = await RideBooking.findOne({ rideCode: referenceId });
  if (!ride) {
    throw Object.assign(new Error(`Không tìm thấy chuyến ${referenceId}`), { statusCode: 404 });
  }
  const amount = Math.floor(Number(ride.finalFare || ride.quotedFare || 0));
  if (amount <= 0) {
    throw Object.assign(new Error("Chuyến chưa có số tiền thanh toán"), { statusCode: 400 });
  }
  ride.payment = ride.payment || {};
  ride.payment.orderCode = orderCode;
  ride.payment.createdAt = new Date();
  await ride.save();
  return { amountInt: amount, orderInfo: `ride_hailing:${referenceId}` };
};

export const attachRideHailingCheckout = async ({ purpose, referenceId, paymentData, provider }) => {
  if (purpose !== "ride_hailing") return;
  await RideBooking.updateOne(
    { rideCode: referenceId },
    {
      $set: {
        "payment.orderCode": paymentData.orderCode,
        "payment.amount": paymentData.amount,
        "payment.checkoutUrl": paymentData.checkoutUrl,
        "payment.provider": provider,
      },
    }
  );
};

const creditDriver = async ({ driverId, amount, note }) => {
  if (!driverId) return;
  const wallet = await DriverWallet.findOne({ driver: driverId });
  if (!wallet) {
    console.warn("[rideHailing] no driver wallet, skip credit", String(driverId));
    return;
  }
  const net = Math.round(Number(amount) * (1 - getCommissionRate()));
  const balanceBefore = wallet.balance;
  wallet.balance += net;
  wallet.totalEarnings += net;
  await wallet.save();
  await DriverTransaction.create({
    driver: driverId,
    wallet: wallet._id,
    type: "ride_hailing_income",
    amount: net,
    balanceBefore,
    balanceAfter: wallet.balance,
    note,
  });
};

export const settleRideHailingPayment = async ({ orderCode, amount, isSuccess }) => {
  const ride = await RideBooking.findOne({ "payment.orderCode": orderCode });
  if (!ride) return null;
  const result = await confirmRidePayment(ride, { amount, isSuccess });
  if (isSuccess && !result.duplicate && ride.driverId) {
    await creditDriver({
      driverId: ride.driverId,
      amount,
      note: `Thu nhập đặt xe ${ride.rideCode}`,
    });
    await notifyUsers({
      userIds: [ride.customerId, ride.driverId],
      title: "Thanh toán chuyến đi thành công",
      message: `Chuyến ${ride.rideCode} đã thanh toán ${amount}₫`,
      type: "payment",
      meta: { rideId: ride._id },
    });
  }
  const baseUrl = process.env.EXPO_REDIRECT_BASE;
  return {
    type: "ride_hailing",
    rideCode: ride.rideCode,
    status: result.ride.status,
    paymentStatus: result.ride.paymentStatus,
    amount,
    isSuccess,
    duplicate: result.duplicate,
    redirectUrl: isSuccess
      ? `${baseUrl}/--/ride-hailing-success?rideCode=${ride.rideCode}`
      : `${baseUrl}/--/ride-hailing-failed?rideCode=${ride.rideCode}`,
  };
};
