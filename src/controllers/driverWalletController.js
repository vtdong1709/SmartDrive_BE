import { getDriverWalletService, createDriverWalletService } from "../services/driverWalletService.js";
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
