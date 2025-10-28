import { getDriverWalletService, createDriverWalletService, updateDriverWalletBankAccountService, getDriverTransactionsService } from "../services/driverWalletService.js";
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
