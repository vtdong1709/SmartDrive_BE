import mongoose from "mongoose";
import DriverTransaction from "../models/DriverTransaction.js";
import User from "../models/User.js";

/**
 * Map loại giao dịch thành kênh hiển thị
 */
function mapChannel(tx, booking) {
  if (tx.type === "withdraw") return "withdraw";
  if (tx.type === "commission_deduct") return "internal";
  if (tx.type === "adjustment") return "adjustment";

  // booking_income
  const pm = booking?.paymentMethod;
  if (pm === "system") return "payos";
  if (pm === "toDriver") return "cash";
  return "other";
}

function mapStatus(tx, booking, withdrawRequest) {
  if (tx.type === "withdraw") return withdrawRequest?.status || "pending";
  if (tx.type === "commission_deduct") return "completed";
  if (tx.type === "adjustment") return "completed";
  return booking?.paymentStatus || "Pending";
}

/**
 * Lấy danh sách giao dịch phục vụ dashboard
 * - Hỗ trợ lọc: type, driverId, from, to
 * - Phân trang: page, limit
 */
export const getTransactionsDashboardService = async ({
  page = 1,
  limit = 20,
  type,
  driverId,
  from,
  to,
}) => {
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const limitNum = Math.max(parseInt(limit) || 20, 1);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (type) {
    query.type = type;
  }

  if (driverId) {
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      throw Object.assign(new Error("driverId không hợp lệ"), {
        statusCode: 400,
      });
    }
    query.driver = driverId;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    DriverTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: "booking",
        select: "bookingCode payment paymentStatus paymentMethod",
      })
      .populate({
        path: "withdrawRequest",
        select: "amount status createdAt bankInfo adminNote",
      })
      .populate({ path: "driver", select: "fullName phone email" })
      .lean(),
    DriverTransaction.countDocuments(query),
  ]);

  const mapped = items.map((tx) => {
    const booking = tx.booking;
    const withdrawRequest = tx.withdrawRequest;
    const channel = mapChannel(tx, booking);
    const status = mapStatus(tx, booking, withdrawRequest);

    return {
      id: tx._id,
      driverId: tx.driver?._id || null,
      driverName: tx.driver?.fullName || null,
      type: tx.type,
      channel,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      bookingCode: booking?.bookingCode || null,
      orderCode: booking?.payment?.orderCode || null,
      paymentMethod: booking?.paymentMethod || null,
      paymentStatus: booking?.paymentStatus || null,
      withdrawStatus: withdrawRequest?.status || null,
      note: tx.note || null,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  });

  return {
    transactions: mapped,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

