import { sendNotification } from "../../../services/notificationService.js";
import { getIO } from "../../../socket.js";

const safeIo = () => {
  try {
    return getIO();
  } catch {
    return { to: () => ({ emit: () => {} }), emit: () => {} };
  }
};

export const emitRide = (event, payload) => {
  const io = safeIo();
  const body = { ...payload, at: new Date().toISOString() };
  io.emit(event, body);
  if (payload.rideId) io.to(`ride:${payload.rideId}`).emit(event, body);
  if (payload.customerId) io.to(`user:${payload.customerId}`).emit(event, body);
  if (payload.driverId) io.to(`user:${payload.driverId}`).emit(event, body);
};

export const notifyUsers = async ({ userIds, title, message, type = "booking", meta = {} }) => {
  const io = safeIo();
  for (const userId of (userIds || []).filter(Boolean)) {
    try {
      await sendNotification(io, { userId, title, message, type, meta });
    } catch (error) {
      console.error("[rideHailing] notify", error.message);
    }
  }
};
