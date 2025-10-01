import { createPricingService, deletePricingService, getAllPricingService, getPricingByIdService, updatePricingService } from "../services/pricingService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

  
  export const createPricing = async (req, res) => {
    try {
      const pricing = await createPricingService(req.body);
      res.status(201).json(successResponse("Thiết lập giá thành công.",  pricing ));
    } catch (error) {
      res.status(400).json(errorResponse(error.message, error.code));
    }
  };
  
  export const getAllPricing = async (req, res) => {
    try {
      const pricing = await getAllPricingService();
      res.status(200).json(successResponse("Lấy tất cả giá thành công.", pricing));
    } catch (error) {
      res.status(500).json(errorResponse(error.message, error.code));
    }
  };
  
  export const getPricingById = async (req, res) => {
    try {
      const pricing = await getPricingByIdService(req.params.id);
      if (!pricing) {
        return res.status(404).json(errorResponse("Pricing not found", 404));
      }
      res.status(200).json(successResponse("Lấy giá thành công.", pricing));
    } catch (error) {
      res.status(500).json(errorResponse(error.message, error.code));
    }
  };
  
  export const updatePricing = async (req, res) => {
    try {
      const pricing = await updatePricingService(req.params.id, req.body);
      if (!pricing) {
        return res.status(404).json(errorResponse("Pricing not found", 404));
      }
      res.status(200).json(successResponse("Cập nhật giá thành công.", pricing));
    } catch (error) {
      res.status(400).json(errorResponse(error.message, error.code));
    }
  };
  
  export const deletePricing = async (req, res) => {
    try {
      const pricing = await deletePricingService(req.params.id);
      if (!pricing) {
        return res.status(404).json(errorResponse("Pricing not found", 404));
      }
      res.status(200).json(successResponse("Xóa giá thành công.", pricing));
    } catch (error) {
      res.status(500).json(errorResponse(error.message, error.code));
    }
  };
  