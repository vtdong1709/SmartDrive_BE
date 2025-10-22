import Booking from "../models/Booking";

export const createPaymentForBookingService = async (bookingCode) => {
  const payos = getPayOS();

  try {
    const booking = await Booking.findOne({ bookingCode });
    if (!booking) {
      throw Object.assign(new Error("Không tìm thấy thông tin booking"), {
        statusCode: 404,
      });
    }

    const orderCode =
      Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);

    const amountInt = Math.floor(Number(booking.price));
    if (!amountInt || amountInt <= 0) {
      throw Object.assign(new Error("Giá trị thanh toán không hợp lệ"), {
        statusCode: 400,
      });
    }

    const description = `Thanh toán đơn ${bookingCode}`;

    console.log("Creating PayOS payment:", {
      orderCode,
      amountInt,
      bookingCode,
      description,
    });

    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: amountInt,
      description,
      returnUrl: "myapp://payment-success",
      cancelUrl: "myapp://payment-cancel",
      items: [
        {
          name: `Thuê xe điện ${bookingCode}`,
          quantity: 1,
          price: amountInt,
        },
      ],
    });

    booking.paymentLinkId = paymentLink.paymentLinkId;
    booking.orderCode = orderCode;
    await booking.save();

    return {
      bookingCode,
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
      status: paymentLink.status,
    };
  } catch (err) {
    console.error("Tạo link thanh toán PayOS thất bại:", err);

    throw Object.assign(
      new Error("Không thể tạo link thanh toán, vui lòng thử lại sau."),
      {
        statusCode: err.statusCode || 500,
        detail: err.message,
      }
    );
  }
};
