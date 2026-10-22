import { PAYMENT_STATUS } from "../constants.js";

export const shouldApplyPayment = (booking) => {
  return booking.paymentStatus !== PAYMENT_STATUS.PAID;
};
