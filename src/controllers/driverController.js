import {
  approveApplicationService,
  getAllOnlineDrivers,
  getApplicationByIdService,
  getMyApplicationService,
  getOnlineDriverCount,
  listApplicationsService,
  rejectApplicationService,
  setMyAvailabilityService,
  submitApplicationService,
  upsertDraftApplicationService,
} from "../services/driverApplicationService.js";
import { errorResponse, successResponse } from "../utils/apiResponse.js";

// User: create/update draft
export const upsertDraftApplication = async (req, res) => {
  try {
    const result = await upsertDraftApplicationService(req.user.id, req.body);
    const status = result.isNew ? 201 : 200;
    res.status(status).json(successResponse("Lưu hồ sơ nháp thành công", result.app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

import { deleteMyApplicationService, updateMyApplicationService } from "../services/driverApplicationService.js";

// User: update my application by id
export const updateMyApplication = async (req, res) => {
  try {
    const app = await updateMyApplicationService(req.user.id, req.params.id, req.body);
    res.status(200).json(successResponse("Cập nhật hồ sơ thành công", app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// User: delete my application by id
export const deleteMyApplication = async (req, res) => {
  try {
    const result = await deleteMyApplicationService(req.user.id, req.params.id);
    res.status(200).json(successResponse("Xóa hồ sơ thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// User: get my application
export const getMyApplication = async (req, res) => {
  try {
    const app = await getMyApplicationService(req.user.id);
    res.status(200).json(successResponse("Lấy hồ sơ thành công", app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// User: submit
export const submitApplication = async (req, res) => {
  try {
    const app = await submitApplicationService(req.user.id, req.params.id);
    res.status(200).json(successResponse("Gửi hồ sơ thành công", app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// Admin: list
export const listApplications = async (req, res) => {
  try {
    const { status, search, page, limit, createdFrom, createdTo, yearsMin, yearsMax, services } = req.query;
    const result = await listApplicationsService({ status, search, page, limit, createdFrom, createdTo, yearsMin, yearsMax, services });
    res.status(200).json(successResponse("Lấy danh sách hồ sơ thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// Admin: details
export const getApplicationById = async (req, res) => {
  try {
    const app = await getApplicationByIdService(req.params.id);
    res.status(200).json(successResponse("Lấy chi tiết hồ sơ thành công", app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// Admin: approve
export const approveApplication = async (req, res) => {
  try {
    const result = await approveApplicationService(req.params.id);
    res.status(200).json(successResponse("Duyệt hồ sơ thành công", result));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// Admin: reject
export const rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const app = await rejectApplicationService(req.params.id, reason);
    res.status(200).json(successResponse("Từ chối hồ sơ thành công", app));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

// Driver: toggle availability
export const setMyAvailability = async (req, res) => {
  try {
    const { online } = req.body;
    const profile = await setMyAvailabilityService(req.user.id, Boolean(online));
    res.status(200).json(successResponse("Cập nhật trạng thái thành công", profile));
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
};

export async function toggleAvailability(req, res) {
  try {
    const { online } = req.body;
    const userId = req.user.id; // lấy từ JWT
    const profile = await setMyAvailabilityService(userId, online);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
}

export async function countOnlineDrivers(req, res) {
  try{
    const count = await getOnlineDriverCount();
    res.json({ success: true, count });
  }catch(error){
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
}

export async function listOnlineDrivers(req, res) {
  try {
    const drivers = await getAllOnlineDrivers();
  res.json({ success: true, drivers });
  } catch (error) {
    res.status(error.statusCode || 500).json(errorResponse(error.message, error.statusCode || 500));
  }
  
}

