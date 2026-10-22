import Booking from "../models/Booking.js";
import DriverWallet from "../models/DriverWallet.js";
import DriverTransaction from "../models/DriverTransaction.js";
import { getIO } from "../socket.js";
import {
  buildVNPayPaymentUrl,
  getVNPayConfig,
  signVNPayParams,
} from "../config/vnpay.js";

const getCommissionRate = () => {
  const raw = process.env.BOOKING_COMMISSION_RATE;
  const percent = raw != null ? Number(raw) : 15;
  if (isNaN(percent)) return 0.15;
  const clamped = Math.min(Math.max(percent, 0), 100);
  return clamped / 100;
};

const getVietnamTimeFormatted = (date = new Date()) => {
  const vnDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const yyyy = vnDate.getFullYear();
  const mm = String(vnDate.getMonth() + 1).padStart(2, "0");
  const dd = String(vnDate.getDate()).padStart(2, "0");
  const hh = String(vnDate.getHours()).padStart(2, "0");
  const min = String(vnDate.getMinutes()).padStart(2, "0");
  const ss = String(vnDate.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
};

const createTxnRef = () => {
  return Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
};

export const createVNPayPaymentService = async ({
  purpose,
  referenceId,
  amount,
  ipAddr,
}) => {
  const { tmnCode, hashSecret, vnpUrl, returnUrl } = getVNPayConfig();
  const txnRef = createTxnRef();

  let amountInt = 0;
  let orderInfo = "";

  if (purpose === "booking") {
    const booking = await Booking.findOne({ bookingCode: referenceId });
    if (!booking) {
      throw Object.assign(new Error(`Không tìm thấy booking với mã ${referenceId}`), {
        statusCode: 404,
      });
    }
    amountInt = Math.floor(Number(booking.totalAmount ?? booking.price));
    orderInfo = `booking:${referenceId}`;

    booking.payment = booking.payment || {};
    booking.payment.orderCode = txnRef;
    await booking.save();
  } else if (purpose === "wallet_topup") {
    const wallet = await DriverWallet.findById(referenceId);
    if (!wallet) {
      throw Object.assign(new Error("Không tìm thấy ví tài xế"), { statusCode: 404 });
    }
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw Object.assign(new Error("Thiếu hoặc sai số tiền nạp ví"), {
        statusCode: 400,
      });
    }

    amountInt = Math.floor(Number(amount));
    orderInfo = `wallet_topup:${referenceId}`;

    wallet.lastTopupRequest = wallet.lastTopupRequest || {};
    wallet.lastTopupRequest.orderCode = txnRef;
    wallet.lastTopupRequest.status = "pending";
    await wallet.save();
  } else if (purpose === "shared_ride" || purpose === "shared_ride_charter") {
    const { prepareSharedRidePayment } = await import(
      "../modules/sharedRide/services/paymentHook.js"
    );
    const prepared = await prepareSharedRidePayment({
      purpose,
      referenceId,
      orderCode: txnRef,
    });
    amountInt = prepared.amountInt;
    orderInfo = prepared.orderInfo;
  } else if (purpose === "self_drive" || purpose === "self_drive_deposit") {
    const { prepareSelfDrivePayment } = await import(
      "../modules/selfDrive/services/paymentHook.js"
    );
    const prepared = await prepareSelfDrivePayment({
      purpose,
      referenceId,
      orderCode: txnRef,
    });
    amountInt = prepared.amountInt;
    orderInfo = prepared.orderInfo;
  } else {
    throw Object.assign(new Error("purpose không hợp lệ"), { statusCode: 400 });
  }

  const createDate = getVietnamTimeFormatted();
  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: amountInt * 100,
    vnp_CurrCode: "VND",
    vnp_TxnRef: String(txnRef),
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: createDate,
  };

  const paymentUrl = buildVNPayPaymentUrl(vnpUrl, vnpParams, hashSecret);

  const paymentData = {
    orderCode: txnRef,
    amount: amountInt,
    checkoutUrl: paymentUrl,
    description: orderInfo,
    createdAt: new Date(),
  };

  if (purpose === "booking") {
    await Booking.updateOne(
      { bookingCode: referenceId },
      { $set: { payment: paymentData } }
    );
  } else if (purpose === "wallet_topup") {
    await DriverWallet.updateOne(
      { _id: referenceId },
      { $set: { lastTopupRequest: paymentData } }
    );
  } else if (purpose === "shared_ride" || purpose === "shared_ride_charter") {
    const { attachSharedRideCheckout } = await import(
      "../modules/sharedRide/services/paymentHook.js"
    );
    await attachSharedRideCheckout({
      purpose,
      referenceId,
      paymentData,
      provider: "vnpay",
    });
  } else if (purpose === "self_drive" || purpose === "self_drive_deposit") {
    const { attachSelfDriveCheckout } = await import(
      "../modules/selfDrive/services/paymentHook.js"
    );
    await attachSelfDriveCheckout({
      purpose,
      referenceId,
      paymentData,
      provider: "vnpay",
    });
  }

  return paymentData;
};

const verifyVNPayQuery = (query) => {
  const { hashSecret } = getVNPayConfig();
  const input = { ...query };
  const vnpSecureHash = input.vnp_SecureHash;

  delete input.vnp_SecureHash;
  delete input.vnp_SecureHashType;

  const signed = signVNPayParams(input, hashSecret);
  return signed === vnpSecureHash;
};

export const handleVNPayIPNService = async (query) => {
  if (!verifyVNPayQuery(query)) {
    throw Object.assign(new Error("Chữ ký VNPay không hợp lệ"), { statusCode: 400 });
  }

  const txnRef = Number(query.vnp_TxnRef);
  const amount = Number(query.vnp_Amount) / 100;
  const isSuccess = query.vnp_ResponseCode === "00";
  const io = getIO();
  const baseUrl = process.env.EXPO_REDIRECT_BASE;

  const booking = await Booking.findOne({
    "payment.orderCode": txnRef,
  }).populate("driverId customerId");

  const wallet = !booking
    ? await DriverWallet.findOne({ "lastTopupRequest.orderCode": txnRef })
    : null;

  if (!booking && !wallet) {
    const { settleSharedRidePayment } = await import(
      "../modules/sharedRide/services/paymentHook.js"
    );
    const shared = await settleSharedRidePayment({
      orderCode: txnRef,
      amount,
      isSuccess,
    });
    if (shared) return shared;
    const { settleSelfDrivePayment } = await import(
      "../modules/selfDrive/services/paymentHook.js"
    );
    const selfDrive = await settleSelfDrivePayment({
      orderCode: txnRef,
      amount,
      isSuccess,
    });
    if (selfDrive) return selfDrive;
    throw Object.assign(
      new Error("Không tìm thấy booking hoặc ví tài xế tương ứng"),
      { statusCode: 404 }
    );
  }

  if (booking) {
    if (booking.paymentStatus === "Paid" && isSuccess) {
      return {
        type: "booking",
        redirectUrl: `${baseUrl}/--/booking-success?bookingCode=${booking.bookingCode}`,
        bookingCode: booking.bookingCode,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        amount,
        isSuccess,
      };
    }

    booking.paymentStatus = isSuccess ? "Paid" : "Failed";
    booking.status = isSuccess ? "Confirmed" : "Cancelled";
    booking.payment.amount = amount;
    await booking.save();

    if (isSuccess && booking.driverId) {
      const commissionRate = getCommissionRate();
      const netAmount = Math.round(Number(amount) * (1 - commissionRate));

      const driverWallet = await DriverWallet.findOne({ driver: booking.driverId });
      if (!driverWallet) {
        throw Object.assign(new Error("Không tìm thấy ví của tài xế để cộng tiền"), {
          statusCode: 404,
        });
      }

      const balanceBefore = driverWallet.balance;
      driverWallet.balance += netAmount;
      driverWallet.totalEarnings += netAmount;
      await driverWallet.save();

      await DriverTransaction.create({
        driver: booking.driverId,
        wallet: driverWallet._id,
        booking: booking._id,
        type: "booking_income",
        amount: netAmount,
        balanceBefore,
        balanceAfter: driverWallet.balance,
        note: `Nhận tiền từ booking ${booking.bookingCode} qua VNPay`,
      });

      io.emit("walletUpdated", {
        type: "wallet_topup",
        driverWalletId: driverWallet._id,
        balance: driverWallet.balance,
        addedAmount: netAmount,
        message: `Cộng ${netAmount}₫ vào ví sau khi hoàn tất chuyến đi ${booking.bookingCode}`,
      });
    }

    io.emit("paymentStatus", {
      type: "booking",
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      amount,
      isSuccess,
      message: isSuccess
        ? "Thanh toán chuyến đi thành công"
        : "Thanh toán chuyến đi thất bại hoặc bị hủy",
    });

    const redirectUrl = isSuccess
      ? `${baseUrl}/--/booking-success?bookingCode=${booking.bookingCode}`
      : `${baseUrl}/--/booking-failed?bookingCode=${booking.bookingCode}`;

    return {
      type: "booking",
      redirectUrl,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      amount,
      isSuccess,
    };
  }

  if (wallet.lastTopupRequest?.status === "success" && isSuccess) {
    return {
      type: "wallet_topup",
      redirectUrl: `${baseUrl}/--/wallet-success`,
      walletId: wallet._id,
      amount,
      status: wallet.lastTopupRequest.status,
      balance: wallet.balance,
      isSuccess,
    };
  }

  if (isSuccess) {
    const balanceBefore = wallet.balance;
    wallet.balance += Number(amount);
    wallet.lastTopupRequest.status = "success";

    await DriverTransaction.create({
      driver: wallet.driver,
      wallet: wallet._id,
      type: "adjustment",
      amount,
      balanceBefore,
      balanceAfter: wallet.balance,
      note: "Nạp tiền vào ví qua VNPay",
    });
  } else {
    wallet.lastTopupRequest.status = "failed";
  }

  await wallet.save();

  io.emit("walletTopupStatus", {
    type: "wallet_topup",
    driverWalletId: wallet._id,
    amount,
    status: wallet.lastTopupRequest.status,
    balance: wallet.balance,
    isSuccess,
  });

  const redirectUrl = isSuccess
    ? `${baseUrl}/--/wallet-success`
    : `${baseUrl}/--/wallet-failed`;

  return {
    type: "wallet_topup",
    redirectUrl,
    walletId: wallet._id,
    amount,
    status: wallet.lastTopupRequest.status,
    balance: wallet.balance,
    isSuccess,
  };
};
