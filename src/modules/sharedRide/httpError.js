export function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, code: statusCode });
}

export function assertOwner(resourceUserId, requesterId, message = "Không có quyền thực hiện thao tác này") {
  if (String(resourceUserId) !== String(requesterId)) {
    throw httpError(message, 403);
  }
}
