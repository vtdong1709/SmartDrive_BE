export function httpError(message, statusCode = 400, errorCode = null) {
  return Object.assign(new Error(message), { statusCode, code: statusCode, errorCode });
}

export function assertOwner(idA, idB, message = "Không có quyền", errorCode = "FORBIDDEN") {
  if (String(idA) !== String(idB)) throw httpError(message, 403, errorCode);
}
