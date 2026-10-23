import { getPayOS } from "../config/payOS.js";
import Booking from "../models/Booking.js";
import DriverWallet from "../models/DriverWallet.js";
import DriverTransaction from "../models/DriverTransaction.js";
import { getIO } from "../socket.js";

// Lấy phần trăm hoa hồng từ ENV, mặc định 15%
const getCommissionRate = () => {
  const raw = process.env.BOOKING_COMMISSION_RATE;
  const percent = raw != null ? Number(raw) : 15;
  if (isNaN(percent)) return 0.15;
  const clamped = Math.min(Math.max(percent, 0), 100);
  return clamped / 100; // chuyển về tỉ lệ (0-1)
};

export const createPaymentLinkService = async ({
  purpose,
  referenceId,
  amount,
}) => {
  const payos = getPayOS();

  try {
    const orderCode =
      Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);

    let amountInt = 0;
    let description = "";

    // 🔹 Lấy amount và description theo loại purpose
    if (purpose === "booking") {
      const booking = await Booking.findOne({ bookingCode: referenceId });
      if (!booking)
        throw new Error(`Không tìm thấy booking với mã ${referenceId}`);

      amountInt = Math.floor(Number(booking.totalAmount ?? booking.price));
      // Mô tả ngắn gọn, tuân thủ ≤ 25 kí tự
      description = `TT BK ${referenceId}`;

      // Reset link cũ nếu có, cập nhật orderCode mới
      booking.payment = booking.payment || {};
      booking.payment.orderCode = orderCode;
      await booking.save();
    } else if (purpose === "wallet_topup") {
      const wallet = await DriverWallet.findById(referenceId);
      if (!wallet) throw new Error(`Không tìm thấy ví tài xế`);

      if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw Object.assign(new Error("Thiếu hoặc sai số tiền nạp ví"), {
          statusCode: 400,
        });
      }

      amountInt = Math.floor(Number(amount));
      description = `Nap vi tai xe`;

      wallet.lastTopupRequest = wallet.lastTopupRequest || {};
      wallet.lastTopupRequest.orderCode = orderCode;
      wallet.lastTopupRequest.status = "pending";
      await wallet.save();
    } else if (purpose === "shared_ride" || purpose === "shared_ride_charter") {
      const { prepareSharedRidePayment } = await import(
        "../modules/sharedRide/services/paymentHook.js"
      );
      const prepared = await prepareSharedRidePayment({
        purpose,
        referenceId,
        orderCode,
      });
      amountInt = prepared.amountInt;
      description = prepared.orderInfo.slice(0, 25);
    } else if (purpose === "self_drive" || purpose === "self_drive_deposit") {
      const { prepareSelfDrivePayment } = await import(
        "../modules/selfDrive/services/paymentHook.js"
      );
      const prepared = await prepareSelfDrivePayment({
        purpose,
        referenceId,
        orderCode,
      });
      amountInt = prepared.amountInt;
      description = prepared.orderInfo.slice(0, 25);
    } else if (purpose === "ride_hailing") {
      const { prepareRideHailingPayment } = await import(
        "../modules/rideHailing/services/paymentHook.js"
      );
      const prepared = await prepareRideHailingPayment({
        purpose,
        referenceId,
        orderCode,
      });
      amountInt = prepared.amountInt;
      description = prepared.orderInfo.slice(0, 25);
    } else {
      throw new Error("purpose không hợp lệ");
    }

    // 🔹 Tạo link thanh toán PayOS (mô tả tối đa 25 kí tự theo yêu cầu PayOS)
    const payosDescription = (description || "Thanh toan").slice(0, 25);
    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: amountInt,
      description: payosDescription,
      returnUrl: "myapp://payment-success",
      cancelUrl: "myapp://payment-cancel",
      items: [
        {
          name: payosDescription,
          quantity: 1,
          price: amountInt,
        },
      ],
    });

    // 🔹 Lưu toàn bộ thông tin link vào DB (không có status)
    const paymentData = {
      orderCode,
      amount: amountInt,
      bank: paymentLink.accountNumber
        ? {
            bankName: "MBBank",
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
          }
        : null,
      qrCode: paymentLink.qrCode,
      checkoutUrl: paymentLink.checkoutUrl,
      description: payosDescription,
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
        provider: "payos",
      });
    } else if (purpose === "self_drive" || purpose === "self_drive_deposit") {
      const { attachSelfDriveCheckout } = await import(
        "../modules/selfDrive/services/paymentHook.js"
      );
      await attachSelfDriveCheckout({
        purpose,
        referenceId,
        paymentData,
        provider: "payos",
      });
    } else if (purpose === "ride_hailing") {
      const { attachRideHailingCheckout } = await import(
        "../modules/rideHailing/services/paymentHook.js"
      );
      await attachRideHailingCheckout({
        purpose,
        referenceId,
        paymentData,
        provider: "payos",
      });
    }

    // 🔹 Trả dữ liệu cho client
    return paymentData;
  } catch (err) {
    console.error("Tạo link thanh toán PayOS thất bại:", err);
    throw Object.assign(
      new Error("Không thể tạo link thanh toán, vui lòng thử lại sau."),
      {
        statusCode: 500,
        detail: err.message,
      }
    );
  }
};

export const handlePayOSWebhookService = async (body) => {
  const payos = getPayOS();
  let verifiedData;

  try {
    // Xác minh chữ ký webhook
    verifiedData = await payos.webhooks.verify(body);
    console.log("Webhook verified:", verifiedData);
  } catch (err) {
    console.error("Xác minh webhook thất bại:", err.message);
    throw Object.assign(new Error("Xác minh chữ ký webhook thất bại"), {
      statusCode: 400,
      detail: err.message,
    });
  }

  const { orderCode, amount, code, desc } = verifiedData;
  const isSuccess =
    code === "00" || desc?.toLowerCase()?.includes("thành công");

  const io = getIO();

  // ======================================================
  // 🔹 TÌM BOOKING
  // ======================================================
  const booking = await Booking.findOne({
    "payment.orderCode": orderCode,
  }).populate("driverId customerId");

  const wallet = !booking
    ? await DriverWallet.findOne({ "lastTopupRequest.orderCode": orderCode })
    : null;

  if (!booking && !wallet) {
    const { settleSharedRidePayment } = await import(
      "../modules/sharedRide/services/paymentHook.js"
    );
    const shared = await settleSharedRidePayment({
      orderCode,
      amount,
      isSuccess,
    });
    if (shared) return shared;
    const { settleSelfDrivePayment } = await import(
      "../modules/selfDrive/services/paymentHook.js"
    );
    const selfDrive = await settleSelfDrivePayment({
      orderCode,
      amount,
      isSuccess,
    });
    if (selfDrive) return selfDrive;
    const { settleRideHailingPayment } = await import(
      "../modules/rideHailing/services/paymentHook.js"
    );
    const rideHailing = await settleRideHailingPayment({
      orderCode,
      amount,
      isSuccess,
    });
    if (rideHailing) return rideHailing;
    throw Object.assign(
      new Error("Không tìm thấy booking hoặc ví tài xế tương ứng"),
      { statusCode: 404 }
    );
  }

  // ======================================================
  // 🔹 XỬ LÝ BOOKING ĐÃ THANH TOÁN
  // ======================================================
  if (booking) {
    console.log("📦 Xử lý thanh toán cho booking:", booking.bookingCode);

    booking.paymentStatus = isSuccess ? "Paid" : "Failed";
    booking.status = isSuccess ? "Confirmed" : "Cancelled";
    booking.payment.amount = amount;
    await booking.save();

    // 👉 Nếu thanh toán thành công, trừ hoa hồng 15% rồi cộng tiền cho tài xế
    if (isSuccess && booking.driverId) {
      const commissionRate = getCommissionRate();
      const netAmount = Math.round(Number(amount) * (1 - commissionRate));

      let driverWallet = await DriverWallet.findOne({
        driver: booking.driverId,
      });
      if (!driverWallet) {
        throw Object.assign(
          new Error("Không tìm thấy ví của tài xế để cộng tiền"),
          { statusCode: 404 }
        );
      }

      const balanceBefore = driverWallet.balance;
      driverWallet.balance += netAmount;
      driverWallet.totalEarnings += netAmount;
      await driverWallet.save();

      // 👉 Ghi lại transaction cho tài xế
      await DriverTransaction.create({
        driver: booking.driverId,
        wallet: driverWallet._id,
        booking: booking._id,
        type: "booking_income",
        amount: netAmount,
        balanceBefore,
        balanceAfter: driverWallet.balance,
        note: `Nhận tiền từ booking ${booking.bookingCode}`,
      });

      console.log(
        `💰 Tài xế ${booking.driverId} nhận ${netAmount}₫ sau khi trừ hoa hồng`
      );

      io.emit("walletUpdated", {
        type: "wallet_topup",
        driverWalletId: driverWallet._id,
        balance: driverWallet.balance,
        addedAmount: netAmount,
        message: `Cộng ${netAmount}₫ vào ví sau khi hoàn tất chuyến đi ${booking.bookingCode}`,
      });
    }

    const baseUrl = process.env.EXPO_REDIRECT_BASE

    // Emit trạng thái thanh toán
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
      ?  `${baseUrl}/--/booking-success?bookingCode=${booking.bookingCode}`
      :  `${baseUrl}/--/booking-failed?bookingCode=${booking.bookingCode}`;

    return {
      type: "booking",
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      amount,
      isSuccess,
    };
  }

  // ======================================================
  // 🔹 XỬ LÝ NẠP VÍ TÀI XẾ
  // ======================================================
  if (wallet) {
    console.log("💳 Xử lý nạp ví tài xế:", wallet._id);

    if (isSuccess) {
      const balanceBefore = wallet.balance;
      wallet.balance += Number(amount);
      wallet.lastTopupRequest.status = "success";

      await DriverTransaction.create({
        driver: wallet.driver,
        wallet: wallet._id,
        type: "adjustment",
        amount: amount,
        balanceBefore,
        balanceAfter: wallet.balance,
        note: "Nạp tiền vào ví qua PayOS",
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
    ?  `${baseUrl}/--/wallet-success`
    :  `${baseUrl}/--/wallet-failed`;

    return {
      type: "wallet_topup",
      walletId: wallet._id,
      amount,
      status: wallet.lastTopupRequest.status,
      balance: wallet.balance,
      isSuccess,
    };
  }
};
