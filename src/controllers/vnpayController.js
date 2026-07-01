import {
  createVNPayPaymentService,
  handleVNPayIPNService,
} from "../services/vnpayService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

export const createVNPayPaymentController = async (req, res) => {
  try {
    const { purpose, referenceId, amount } = req.body;
    if (!purpose || !referenceId) {
      return res
        .status(400)
        .json(
          errorResponse("Thiếu thông tin bắt buộc: purpose hoặc referenceId", 400)
        );
    }

    const ipAddr =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip;

    const paymentData = await createVNPayPaymentService({
      purpose,
      referenceId,
      amount,
      ipAddr,
    });

    return res
      .status(200)
      .json(successResponse("Tạo link thanh toán VNPay thành công", paymentData));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json(errorResponse(error.message || "Đã xảy ra lỗi", error.statusCode || 500));
  }
};

export const vnpayIPNController = async (req, res) => {
  try {
    await handleVNPayIPNService(req.query);
    return res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    return res.status(200).json({
      RspCode: error.statusCode === 400 ? "97" : "99",
      Message: error.message || "Unknown error",
    });
  }
};

export const vnpayReturnController = async (req, res) => {
  try {
    const result = await handleVNPayIPNService(req.query);
    if (result?.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }
    return res
      .status(200)
      .json(successResponse("Xử lý VNPay return thành công", result));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json(
        errorResponse(
          error.statusCode && error.statusCode < 500
            ? error.message
            : "Lỗi xử lý VNPay return",
          error.statusCode || 500
        )
      );
  }
};
