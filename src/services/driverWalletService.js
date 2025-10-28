import DriverWallet from "../models/DriverWallet.js";
import DriverTransaction from "../models/DriverTransaction.js";
import User from "../models/User.js";
import mongoose from "mongoose";

/**
 * Tạo ví mới cho tài xế
 * @param {string} driverId - ID của tài xế
 * @param {Object} bankAccount - Thông tin tài khoản ngân hàng
 * @returns {Object} Thông tin ví vừa tạo
 */
export const createDriverWalletService = async (driverId, bankAccount) => {
  // Kiểm tra driverId có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw Object.assign(new Error("ID tài xế không hợp lệ"), { statusCode: 400 });
  }

  // Kiểm tra tài xế có tồn tại không
  const driver = await User.findById(driverId);
  if (!driver) {
    throw Object.assign(new Error("Không tìm thấy tài xế"), { statusCode: 404 });
  }

  // Kiểm tra tài xế có phải là driver không
  if (driver.role !== "driver") {
    throw Object.assign(new Error("Người dùng này không phải là tài xế"), { statusCode: 400 });
  }

  // Kiểm tra thông tin tài khoản ngân hàng
  if (!bankAccount || !bankAccount.numberBank || !bankAccount.bankName) {
    throw Object.assign(new Error("Thông tin tài khoản ngân hàng là bắt buộc"), { statusCode: 400 });
  }

  // Kiểm tra ví đã tồn tại chưa
  const existingWallet = await DriverWallet.findOne({ driver: driverId });
  if (existingWallet) {
    throw Object.assign(new Error("Tài xế này đã có ví"), { statusCode: 400 });
  }

  // Tạo ví mới
  const newWallet = new DriverWallet({
    driver: driverId,
    balance: 0,
    debt: 0,
    totalEarnings: 0,
    totalWithdrawn: 0,
    isLocked: false,
    lockReason: null,
    bankAccount: {
      numberBank: bankAccount.numberBank,
      bankName: bankAccount.bankName
    },
    lastTopupRequest: null
  });

  const savedWallet = await newWallet.save();

  // Populate thông tin driver
  const walletWithDriver = await DriverWallet.findById(savedWallet._id).populate({
    path: "driver",
    select: "fullName email phone"
  });

  return walletWithDriver;
};

/**
 * Lấy thông tin ví của tài xế
 * @param {string} driverId - ID của tài xế
 * @param {Object} user - Thông tin user hiện tại
 * @returns {Object} Thông tin ví của tài xế
 */
export const getDriverWalletService = async (driverId, user) => {
  // Kiểm tra quyền truy cập
  if (user.role === "driver" && user.id !== driverId) {
    throw Object.assign(new Error("Bạn chỉ có thể xem ví của chính mình"), { statusCode: 403 });
  }

  // Kiểm tra tài xế có tồn tại không
  const driver = await User.findById(driverId);
  if (!driver) {
    throw Object.assign(new Error("Không tìm thấy tài xế"), { statusCode: 404 });
  }

  // Kiểm tra tài xế có phải là driver không
  if (driver.role !== "driver") {
    throw Object.assign(new Error("Người dùng này không phải là tài xế"), { statusCode: 400 });
  }

  // Tìm ví của tài xế
  const wallet = await DriverWallet.findOne({ driver: driverId }).populate({
    path: "driver",
    select: "fullName email phone"
  });

  if (!wallet) {
    throw Object.assign(new Error("Không tìm thấy ví của tài xế"), { statusCode: 404 });
  }

  return wallet;
};

/**
 * Cập nhật thông tin tài khoản ngân hàng
 * @param {string} driverId - ID của tài xế
 * @param {Object} bankAccount - Thông tin tài khoản ngân hàng mới
 * @param {Object} user - Thông tin user hiện tại
 * @returns {Object} Thông tin ví đã được cập nhật
 */
export const updateDriverWalletBankAccountService = async (driverId, bankAccount, user) => {
  // Kiểm tra quyền truy cập
  if (user.role === "driver" && user.id !== driverId) {
    throw Object.assign(new Error("Bạn chỉ có thể cập nhật ví của chính mình"), { statusCode: 403 });
  }

  // Kiểm tra driverId có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw Object.assign(new Error("ID tài xế không hợp lệ"), { statusCode: 400 });
  }

  // Kiểm tra tài xế có tồn tại không
  const driver = await User.findById(driverId);
  if (!driver) {
    throw Object.assign(new Error("Không tìm thấy tài xế"), { statusCode: 404 });
  }

  // Kiểm tra tài xế có phải là driver không
  if (driver.role !== "driver") {
    throw Object.assign(new Error("Người dùng này không phải là tài xế"), { statusCode: 400 });
  }

  // Kiểm tra thông tin tài khoản ngân hàng
  if (!bankAccount || !bankAccount.numberBank || !bankAccount.bankName) {
    throw Object.assign(new Error("Thông tin tài khoản ngân hàng là bắt buộc"), { statusCode: 400 });
  }

  // Tìm ví của tài xế
  const wallet = await DriverWallet.findOne({ driver: driverId });
  if (!wallet) {
    throw Object.assign(new Error("Không tìm thấy ví của tài xế"), { statusCode: 404 });
  }

  // Cập nhật thông tin tài khoản ngân hàng
  wallet.bankAccount = {
    numberBank: bankAccount.numberBank,
    bankName: bankAccount.bankName
  };

  const updatedWallet = await wallet.save();

  // Populate thông tin driver
  const walletWithDriver = await DriverWallet.findById(updatedWallet._id).populate({
    path: "driver",
    select: "fullName email phone"
  });

  return walletWithDriver;
};

/**
 * Lấy danh sách giao dịch của tài xế theo type
 * @param {string} driverId - ID của tài xế
 * @param {string} type - Loại giao dịch (booking_income, withdraw)
 * @param {Object} user - Thông tin user hiện tại
 * @param {Object} options - Tùy chọn phân trang (page, limit)
 * @returns {Object} Danh sách giao dịch và thông tin phân trang
 */
export const getDriverTransactionsService = async (driverId, type, user, options = {}) => {
  // Kiểm tra quyền truy cập
  if (user.role === "driver" && user.id !== driverId) {
    throw Object.assign(new Error("Bạn chỉ có thể xem giao dịch của chính mình"), { statusCode: 403 });
  }

  // Kiểm tra driverId có hợp lệ không
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw Object.assign(new Error("ID tài xế không hợp lệ"), { statusCode: 400 });
  }

  // Kiểm tra tài xế có tồn tại không
  const driver = await User.findById(driverId);
  if (!driver) {
    throw Object.assign(new Error("Không tìm thấy tài xế"), { statusCode: 404 });
  }

  // Kiểm tra type có hợp lệ không
  const validTypes = ["booking_income", "withdraw"];
  if (!validTypes.includes(type)) {
    throw Object.assign(new Error("Loại giao dịch không hợp lệ. Chỉ chấp nhận: booking_income hoặc withdraw"), { statusCode: 400 });
  }

  // Phân trang
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const skip = (page - 1) * limit;

  // Tìm tất cả giao dịch của driver theo type
  const query = {
    driver: driverId,
    type: type
  };

  // Đếm tổng số giao dịch
  const total = await DriverTransaction.countDocuments(query);

  // Lấy danh sách giao dịch với phân trang
  const transactions = await DriverTransaction.find(query)
    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
    .skip(skip)
    .limit(limit)
    .populate({
      path: "booking",
      select: "bookingCode startAddress endAddress distance duration price"
    })
    .populate({
      path: "withdrawRequest",
      select: "amount status createdAt"
    })
    .lean();

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};