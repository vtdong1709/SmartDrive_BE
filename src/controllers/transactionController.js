import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { getTransactionsDashboardService } from "../services/transactionService.js";

/**
 * Admin/Staff: Lấy danh sách giao dịch để hiển thị dashboard
 * Hỗ trợ lọc theo type, driverId, khoảng thời gian; có phân trang.
 */
export const getTransactionsDashboard = async (req, res) => {
  try {
    const { page, limit, type, driverId, from, to } = req.query;
    const data = await getTransactionsDashboardService({
      page,
      limit,
      type,
      driverId,
      from,
      to,
    });
    return res
      .status(200)
      .json(successResponse("Lấy danh sách giao dịch thành công", data));
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json(errorResponse(error.message || "Lỗi lấy danh sách giao dịch", error.statusCode || 500));
  }
};

