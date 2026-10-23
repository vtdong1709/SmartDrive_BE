export function successResponse(message, data = {}) {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message, code, errorCode) {
  return {
    success: false,
    message,
    code,
    ...(errorCode ? { errorCode } : {}),
  };
}