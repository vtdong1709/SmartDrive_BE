// src/socket.js
let ioInstance = null;

export function initSocket(io) {
  ioInstance = io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO chưa được khởi tạo");
  }
  return ioInstance;
}
