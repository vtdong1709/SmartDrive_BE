import { getPayOS } from "../config/payOS.js";
import Booking from "../models/Booking.js";
import DriverWallet from "../models/DriverWallet.js";
import { getIO } from "../socket.js";

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
      description = `Thanh toán chuyến đi #${referenceId}`;

      // Reset link cũ nếu có, cập nhật orderCode mới
      booking.payment = booking.payment || {};
      booking.payment.orderCode = orderCode;
      await booking.save();
    } else if (purpose === "wallet_topup") {
      const wallet = await DriverWallet.findById(referenceId);
      if (!wallet) throw new Error(`Không tìm thấy ví tài xế`);

      amountInt = Math.floor(Number(amount));
      description = `Nạp tiền vào ví tài xế`;

      wallet.lastTopupRequest = wallet.lastTopupRequest || {};
      wallet.lastTopupRequest.orderCode = orderCode;
      await wallet.save();
    } else {
      throw new Error("purpose không hợp lệ");
    }

    // 🔹 Tạo link thanh toán PayOS
    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: amountInt,
      description,
      returnUrl: "myapp://payment-success",
      cancelUrl: "myapp://payment-cancel",
      items: [
        {
          name: description,
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
      description: paymentLink.description,
      createdAt: new Date(),
      provider: "payos",
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
  }).populate("driver renter");

  const wallet = !booking
    ? await DriverWallet.findOne({ "lastTopupRequest.orderCode": orderCode })
    : null;

  if (!booking && !wallet) {
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
      const netAmount = Math.round(amount * (1 - (15/100)));

      let wallet = await DriverWallet.findOne({ driver: booking.driverId });
      if (!wallet) {
        throw Object.assign(
          new Error("Không tìm thấy ví của tài xế để cộng tiền"),
          { statusCode: 404 }
        );
      }

      const balanceBefore = wallet.balance;
      wallet.balance += netAmount;
      wallet.totalEarnings += netAmount;
      await wallet.save();

      // 👉 Ghi lại transaction cho tài xế
      await DriverTransaction.create({
        driver: booking.driverId,
        wallet: wallet._id,
        booking: booking._id,
        type: "booking_income",
        amount: netAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        note: `Nhận tiền từ booking ${booking.bookingCode}, hoa hồng 15% đã trừ`,
      });

      console.log(
        `💰 Tài xế ${booking.driverId} nhận ${netAmount}₫ sau khi trừ hoa hồng`
      );

      io.emit("walletUpdated", {
        type: "wallet_topup",
        driverWalletId: wallet._id,
        balance: wallet.balance,
        addedAmount: netAmount,
        message: `Cộng ${netAmount}₫ vào ví sau khi hoàn tất chuyến đi ${booking.bookingCode}`,
      });
    }

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
