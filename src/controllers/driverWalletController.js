import { getDriverWalletService, createDriverWalletService, updateDriverWalletBankAccountService, getDriverTransactionsService, createWithdrawRequestService, approveWithdrawRequestService, rejectWithdrawRequestService } from "../services/driverWalletService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

/**
 * Tạo ví mới cho tài xế
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createDriverWallet = async (req, res) => {
  try {
    const { driverId, bankAccount } = req.body;
    const wallet = await createDriverWalletService(driverId, bankAccount);
    res.status(201).json(successResponse("Tạo ví thành công", wallet));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Lấy thông tin ví của tài xế
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getDriverWallet = async (req, res) => {
  try {
    const { driverId } = req.params;
    const wallet = await getDriverWalletService(driverId, req.user);
    res.status(200).json(successResponse("Lấy thông tin ví thành công", wallet));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Cập nhật thông tin tài khoản ngân hàng
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const updateDriverWallet = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { bankAccount } = req.body;
    const wallet = await updateDriverWalletBankAccountService(driverId, bankAccount, req.user);
    res.status(200).json(successResponse("Cập nhật thông tin tài khoản ngân hàng thành công", wallet));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Lấy danh sách giao dịch của tài xế theo type
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getDriverTransactions = async (req, res) => {
  try {
    const { driverId, type } = req.params;
    const { page, limit } = req.query;
    const result = await getDriverTransactionsService(driverId, type, req.user, { page, limit });
    res.status(200).json(successResponse("Lấy danh sách giao dịch thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Tạo yêu cầu rút tiền cho tài xế
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const createWithdrawRequest = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount } = req.body;
    const result = await createWithdrawRequestService(driverId, amount, req.user);
    res.status(201).json(successResponse("Tạo yêu cầu rút tiền thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Duyệt yêu cầu rút tiền (Admin)
 */
export const approveWithdrawRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const result = await approveWithdrawRequestService(requestId, req.user);
    res.status(200).json(successResponse("Duyệt yêu cầu rút tiền thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

/**
 * Từ chối yêu cầu rút tiền và hoàn tiền (Admin)
 */
export const rejectWithdrawRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const result = await rejectWithdrawRequestService(requestId, message, req.user);
    res.status(200).json(successResponse("Từ chối yêu cầu rút tiền thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};
