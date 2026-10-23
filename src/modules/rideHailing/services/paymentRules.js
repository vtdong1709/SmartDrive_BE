import { PAYMENT_STATUS } from "../constants.js";

export const shouldApplyPayment = (ride) => ride?.paymentStatus !== PAYMENT_STATUS.PAID;

export const applyRidePayment = (ride, { amount, isSuccess }) => {
  if (!shouldApplyPayment(ride)) {
    return { ride, duplicate: true };
  }
  ride.paymentStatus = isSuccess ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.FAILED;
  ride.payment = {
    ...(ride.payment || {}),
    amount,
    paidAt: isSuccess ? new Date() : ride.payment?.paidAt || null,
  };
  return { ride, duplicate: false };
};
