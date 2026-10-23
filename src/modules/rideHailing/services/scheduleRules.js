import { ERROR_CODE, getMaxScheduleDays, getMinLeadMinutes, getScheduleLeadMinutes } from "../constants.js";
import { httpError } from "../httpError.js";

export const validateSchedule = (scheduledAt, now = Date.now()) => {
  const at = new Date(scheduledAt);
  if (Number.isNaN(at.getTime()) || !(at.getTime() > now)) {
    throw httpError("scheduledAt không được ở quá khứ", 400, ERROR_CODE.SCHEDULE_TIME_INVALID);
  }
  const minLead = getMinLeadMinutes() * 60 * 1000;
  if (at.getTime() < now + minLead) {
    throw httpError(`Đặt trước tối thiểu ${getMinLeadMinutes()} phút`, 400, ERROR_CODE.SCHEDULE_TIME_INVALID);
  }
  const max = getMaxScheduleDays() * 24 * 60 * 60 * 1000;
  if (at.getTime() > now + max) {
    throw httpError(`Chỉ đặt trước tối đa ${getMaxScheduleDays()} ngày`, 400, ERROR_CODE.SCHEDULE_TIME_INVALID);
  }
  return at;
};

export const shouldSearchScheduledNow = (scheduledAt, now = Date.now(), leadMinutes = getScheduleLeadMinutes()) => {
  if (!scheduledAt) return false;
  return new Date(scheduledAt).getTime() - now <= leadMinutes * 60 * 1000;
};
