import DriverWallet from "../models/DriverWallet.js";
import DriverTransaction from "../models/DriverTransaction.js";
import User from "../models/User.js";
import "../models/WithdrawRequest.js";
import mongoose from "mongoose";
import WithdrawRequest from "../models/WithdrawRequest.js";

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
      select: "amount status createdAt bankInfo adminNote"
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

/**
 * Tạo yêu cầu rút tiền cho tài xế và cập nhật ví + giao dịch một cách an toàn
 * @param {string} driverId
 * @param {number} amount
 * @param {Object} user - user đang thực hiện (driver hoặc admin)
 * @returns {Object} withdrawRequest đã tạo kèm transaction
 */
export const createWithdrawRequestService = async (driverId, amount, user) => {
  // Chỉ cho phép driver tự rút hoặc admin rút hộ
  if (user.role === "driver" && user.id !== driverId) {
    throw Object.assign(new Error("Bạn chỉ có thể tạo yêu cầu rút tiền cho chính mình"), { statusCode: 403 });
  }

  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw Object.assign(new Error("ID tài xế không hợp lệ"), { statusCode: 400 });
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    throw Object.assign(new Error("Số tiền rút không hợp lệ"), { statusCode: 400 });
  }

  const driver = await User.findById(driverId);
  if (!driver || driver.role !== "driver") {
    throw Object.assign(new Error("Không tìm thấy tài xế hợp lệ"), { statusCode: 404 });
  }

  const wallet = await DriverWallet.findOne({ driver: driverId });
  if (!wallet) {
    throw Object.assign(new Error("Không tìm thấy ví của tài xế"), { statusCode: 404 });
  }

  if (wallet.isLocked) {
    throw Object.assign(new Error("Ví đang bị khóa, không thể rút tiền"), { statusCode: 400 });
  }

  if (amount < 10000) {
    throw Object.assign(new Error("Số tiền rút tối thiểu là 10,000"), { statusCode: 400 });
  }

  if (amount > wallet.balance) {
    throw Object.assign(new Error(`Số dư không đủ để rút. Số dư hiện tại: ${wallet.balance}, yêu cầu: ${amount}`), { statusCode: 400 });
  }

  // Không cho phép tạo khi đang có yêu cầu rút tiền chờ xử lý
  const existingPending = await WithdrawRequest.findOne({ driver: driverId, status: "pending" });
  if (existingPending) {
    throw Object.assign(new Error("Đang có yêu cầu rút tiền chờ xử lý. Vui lòng đợi hoàn tất trước khi tạo yêu cầu mới"), { statusCode: 400 });
  }

  // Không dùng transaction (standalone). Dùng cập nhật có điều kiện và hoàn tác khi lỗi
  // 1) Cập nhật ví có điều kiện và lấy số dư trước khi trừ
  let walletBeforeUpdate;
  try {
    walletBeforeUpdate = await DriverWallet.findOneAndUpdate(
      { _id: wallet._id, isLocked: false, balance: { $gte: amount } },
      { $inc: { balance: -amount, totalWithdrawn: amount } },
      { new: false }
    );
  } catch (err) {
    throw Object.assign(new Error("Không thể cập nhật ví"), { statusCode: 500 });
  }

  if (!walletBeforeUpdate) {
    throw Object.assign(new Error("Số dư không đủ hoặc ví bị khóa"), { statusCode: 400 });
  }

  const balanceBefore = walletBeforeUpdate.balance;
  const balanceAfter = balanceBefore - amount;

  // 2) Tạo yêu cầu rút tiền
  let createdWithdrawRequest;
  try {
    createdWithdrawRequest = await WithdrawRequest.create({
      driver: driver._id,
      amount,
      bankInfo: {
        accountNumber: wallet.bankAccount.numberBank,
        accountName: driver.fullName || "",
        bankName: wallet.bankAccount.bankName,
      },
      status: "pending",
    });
  } catch (err) {
    // hoàn tác ví
    await DriverWallet.updateOne({ _id: wallet._id }, { $inc: { balance: amount, totalWithdrawn: -amount } });
    throw Object.assign(new Error("Không thể tạo yêu cầu rút tiền"), { statusCode: 500 });
  }

  // 3) Tạo giao dịch và liên kết
  let createdTransaction;
  try {
    createdTransaction = await DriverTransaction.create({
      driver: driver._id,
      wallet: wallet._id,
      withdrawRequest: createdWithdrawRequest._id,
      type: "withdraw",
      amount: -Math.abs(amount),
      balanceBefore,
      balanceAfter,
      note: "Driver withdraw request",
    });
  } catch (err) {
    // hoàn tác ví và xóa yêu cầu rút tiền vừa tạo
    await DriverWallet.updateOne({ _id: wallet._id }, { $inc: { balance: amount, totalWithdrawn: -amount } });
    await WithdrawRequest.deleteOne({ _id: createdWithdrawRequest._id });
    throw Object.assign(new Error("Không thể tạo giao dịch rút tiền"), { statusCode: 500 });
  }

  // 4) Populate và trả về
  const populatedWithdraw = await WithdrawRequest.findById(createdWithdrawRequest._id)
    .populate({ path: "driver", select: "fullName email phone" });

  return populatedWithdraw;
};

/**
 * Admin duyệt yêu cầu rút tiền
 * @param {string} requestId
 * @param {Object} user
 */
export const approveWithdrawRequestService = async (requestId, user) => {
  if (user.role !== "admin") {
    throw Object.assign(new Error("Chỉ admin mới có quyền duyệt yêu cầu rút tiền"), { statusCode: 403 });
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw Object.assign(new Error("ID yêu cầu rút tiền không hợp lệ"), { statusCode: 400 });
  }

  const request = await WithdrawRequest.findById(requestId);
  if (!request) {
    throw Object.assign(new Error("Không tìm thấy yêu cầu rút tiền"), { statusCode: 404 });
  }

  if (request.status !== "pending") {
    throw Object.assign(new Error("Chỉ có thể duyệt yêu cầu ở trạng thái pending"), { statusCode: 400 });
  }

  request.status = "approved"; // hoặc "completed" tùy luồng chi trả thực tế
  request.processedAt = new Date();
  await request.save();

  return await WithdrawRequest.findById(request._id).populate({ path: "driver", select: "fullName email phone" });
};

/**
 * Admin từ chối yêu cầu rút tiền kèm lý do và hoàn tiền về ví
 * @param {string} requestId
 * @param {string} reason
 * @param {Object} user
 */
export const rejectWithdrawRequestService = async (requestId, reason, user) => {
  if (user.role !== "admin") {
    throw Object.assign(new Error("Chỉ admin mới có quyền từ chối yêu cầu rút tiền"), { statusCode: 403 });
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw Object.assign(new Error("ID yêu cầu rút tiền không hợp lệ"), { statusCode: 400 });
  }

  if (!reason || !reason.trim()) {
    throw Object.assign(new Error("Vui lòng cung cấp lý do từ chối"), { statusCode: 400 });
  }

  const request = await WithdrawRequest.findById(requestId);
  if (!request) {
    throw Object.assign(new Error("Không tìm thấy yêu cầu rút tiền"), { statusCode: 404 });
  }

  if (request.status !== "pending") {
    throw Object.assign(new Error("Chỉ có thể từ chối yêu cầu ở trạng thái pending"), { statusCode: 400 });
  }

  // Hoàn tiền về ví
  const wallet = await DriverWallet.findOneAndUpdate(
    { driver: request.driver },
    { $inc: { balance: request.amount, totalWithdrawn: -request.amount } },
    { new: true }
  );

  if (!wallet) {
    throw Object.assign(new Error("Không tìm thấy ví để hoàn tiền"), { statusCode: 404 });
  }

  // Ghi nhận giao dịch hoàn tiền (điều chỉnh)
  const latestBalance = wallet.balance; // sau khi hoàn tiền
  await DriverTransaction.create({
    driver: request.driver,
    wallet: wallet._id,
    withdrawRequest: request._id,
    type: "adjustment",
    amount: Math.abs(request.amount),
    balanceBefore: latestBalance - request.amount,
    balanceAfter: latestBalance,
    note: `Refund after withdraw rejection: ${reason}`,
  });

  // Cập nhật yêu cầu về rejected, lưu adminNote
  request.status = "rejected";
  request.adminNote = reason;
  request.processedAt = new Date();
  await request.save();

  return await WithdrawRequest.findById(request._id).populate({ path: "driver", select: "fullName email phone" });
};