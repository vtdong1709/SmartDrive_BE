export function pricingError(message, statusCode = 400, errorCode = null) {
  return Object.assign(new Error(message), { statusCode, code: statusCode, errorCode });
}
