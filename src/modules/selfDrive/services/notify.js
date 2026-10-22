import { sendNotification } from "../../../services/notificationService.js";
import { getIO } from "../../../socket.js";

const safeIo = () => {
  try {
    return getIO();
  } catch {
    return { to: () => ({ emit: () => {} }), emit: () => {} };
  }
};

export const notifyUsers = async ({ userIds, title, message, type = "booking", meta = {} }) => {
  const io = safeIo();
  for (const userId of (userIds || []).filter(Boolean)) {
    try {
      await sendNotification(io, { userId, title, message, type, meta });
    } catch (error) {
      console.error("[selfDrive] notify failed", error.message);
    }
  }
};

export const emitSelfDrive = (event, payload) => {
  const io = safeIo();
  io.emit(event, { ...payload, at: new Date().toISOString() });
};
