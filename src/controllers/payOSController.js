import {
  createPaymentLinkService,
  handlePayOSWebhookService,
} from "../services/payOSService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

export const createPaymentLinkController = async (req, res) => {
  try {
    const { purpose, referenceId, amount } = req.body;

    if (!purpose || !referenceId) {
      return res
        .status(400)
        .json(
          errorResponse(
            "Thiếu thông tin bắt buộc: purpose hoặc referenceId",
            400
          )
        );
    }

    const paymentData = await createPaymentLinkService({
      purpose,
      referenceId,
      amount,
    });

    return res
      .status(200)
      .json(successResponse("Tạo link thanh toán thành công", paymentData));
  } catch (err) {
    console.error("Lỗi createPaymentLinkController:", err);

    return res
      .status(err.statusCode || 500)
      .json(
        errorResponse(err.message || "Đã xảy ra lỗi", err.statusCode || 500)
      );
  }
};

export const payOSWebhookController = async (req, res) => {
  try {
    const result = await handlePayOSWebhookService(req.body);
    if (result?.redirectUrl) {
      console.log("Redirecting user to:", result.redirectUrl);
      return res.redirect(result.redirectUrl);
    }
    return res
      .status(200)
      .json(successResponse("Xử lý webhook PayOS thành công", result));
  } catch (error) {
    console.error("Webhook error:", error.message);
    res
      .status(error.statusCode || 500)
      .json(
        errorResponse(
          error.statusCode && error.statusCode < 500
            ? error.message
            : "Lỗi xử lý webhook PayOS",
          error.statusCode || 500
        )
      );
  }
};
