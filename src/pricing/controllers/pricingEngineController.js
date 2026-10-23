import { errorResponse, successResponse } from "../../utils/apiResponse.js";
import { createQuote } from "../pricingEngine.js";
import { createPlanVersion } from "../services/pricingPlanService.js";
import PricingPlan from "../models/PricingPlan.js";
import CommissionPlan from "../models/CommissionPlan.js";

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error("[pricing]", error.message);
    return res
      .status(error.statusCode || error.code || 500)
      .json(errorResponse(error.message, error.statusCode || error.code || 500, error.errorCode));
  }
};

export const quote = handle(async (req, res) => {
  const { service, context = {} } = req.body;
  const data = await createQuote({
    service,
    context,
    userId: req.user?._id || null,
  });
  res.json(successResponse("Báo giá", data));
});

export const listPlans = handle(async (req, res) => {
  const filter = {};
  if (req.query.service) filter.service = req.query.service;
  if (req.query.subType) filter.subType = req.query.subType;
  const items = await PricingPlan.find(filter).sort({ service: 1, subType: 1, version: -1 });
  res.json(successResponse("Pricing plans", items));
});

export const createPlan = handle(async (req, res) => {
  const plan = await createPlanVersion(req.body, req.user?._id);
  res.json(successResponse("Đã tạo phiên bản bảng giá mới", plan));
});

export const createCommission = handle(async (req, res) => {
  const plan = await CommissionPlan.create(req.body);
  res.json(successResponse("Commission plan", plan));
});
