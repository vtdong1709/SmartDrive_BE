export function successResponse(message, data = {}) {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message, code) {
  return {
    success: false,
    message,
    code,
  };
}