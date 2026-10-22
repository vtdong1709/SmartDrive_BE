export function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, code: statusCode });
}

export function assertOwner(resourceUserId, requesterId, message = "Bạn không được chỉnh xe/booking của người khác") {
  if (String(resourceUserId) !== String(requesterId)) {
    throw httpError(message, 403);
  }
}
