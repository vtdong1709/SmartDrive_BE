import { getTransporter } from "../config/mailConfig.js";
import Notification from "../models/Notification.js";
import redis from "../redis.js";
import User from "../models/User.js";
import axios from "axios";

function baseTemplate({ title, body }) {
  return `
  <div style="font-family: Arial, sans-serif; background:#f7f7f8; padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #ececec;">
      <h2 style="margin:0 0 12px 0;color:#111827;">${title}</h2>
      <div style="color:#374151;font-size:14px;line-height:20px;">${body}</div>
      <div style="margin-top:24px;color:#9ca3af;font-size:12px;">SmartDrive</div>
    </div>
  </div>`;
}

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const MINI_APP_URL = "https://app.smartdrive.io.vn";

async function sendTelegramMessage(chatId, title, message) {
  if (!chatId) return;

  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: ` ${title}\n${message}`,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: " Mở SmartDrive App",
              web_app: { url: MINI_APP_URL }
            }
          ]
        ]
      }
    });
  } catch (err) {
    console.error("Telegram send error:", err?.response?.data || err.message);
  }
}

export async function notifyApplicationSubmitted(to, name) {
  const transporter = getTransporter();
  const html = baseTemplate({
    title: "Đã nhận hồ sơ tài xế",
    body: `Xin chào <strong>${name}</strong>,<br/>Chúng tôi đã nhận được hồ sơ tài xế của bạn và sẽ xem xét trong 1–3 ngày làm việc.`,
  });
  await transporter.sendMail({
    from: `SmartDrive <${process.env.SMTP_USER}>`,
    to,
    subject: "SmartDrive - Đã nhận hồ sơ tài xế",
    html,
  });
}

export async function notifyApplicationApproved(to, name) {
  const transporter = getTransporter();
  const html = baseTemplate({
    title: "Hồ sơ tài xế đã được duyệt",
    body: `Xin chào <strong>${name}</strong>,<br/>Hồ sơ của bạn đã được duyệt. Vui lòng đăng nhập để bật trạng thái sẵn sàng.`,
  });
  await transporter.sendMail({
    from: `SmartDrive <${process.env.SMTP_USER}>`,
    to,
    subject: "SmartDrive - Hồ sơ đã được duyệt",
    html,
  });
}

export async function notifyApplicationRejected(to, name, reason) {
  const transporter = getTransporter();
  const html = baseTemplate({
    title: "Hồ sơ tài xế bị từ chối",
    body: `Xin chào <strong>${name}</strong>,<br/>Rất tiếc hồ sơ của bạn bị từ chối với lý do: ${reason}. Bạn có thể bổ sung và gửi lại.`,
  });
  await transporter.sendMail({
    from: `SmartDrive <${process.env.SMTP_USER}>`,
    to,
    subject: "SmartDrive - Hồ sơ bị từ chối",
    html,
  });
}

/**
 * sendNotification
 * - lưu notification vào MongoDB (bắt buộc userId)
 * - lưu cache vào Redis (list)
 * - emit realtime qua socket room `user:${userId}`
 *
 * @param {object} io - socket.io server instance
 * @param {object} opts - { userId, title, message, type, meta, email, sendMail }
 */
export async function sendNotification(io, { userId, title, message, type = "info", meta = {}, email = null, sendMail = false }) {
  if (!userId) {
    console.warn("sendNotification: missing userId");
    return null;
  }

  // 1) Lưu vào DB
  let notification = null;
  try {
    notification = await Notification.create({
      userId,
      type,
      title,
      message,
      meta,
      isRead: false,
    });
  } catch (err) {
    console.error("Error creating Notification in DB:", err?.message || err);
  }

  // 2) Lưu cache vào Redis (push left so newest first)
  try {
    const key = `notifications:${String(userId)}`;
    const payload = JSON.stringify({
      _id: notification?._id || null,
      userId,
      type,
      title,
      message,
      meta,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    await redis.lpush(key, payload);
    await redis.ltrim(key, 0, 199);
  } catch (err) {
    console.error("Redis push notification error:", err?.message || err);
  }

  // 3) Emit realtime tới room user:{userId}
  try {
    io.to(`user:${userId}`).emit("newNotification", notification || { title, message, meta, type, createdAt: new Date() });
    // cũng emit đến generic channel để admin/dashboard lắng nghe nếu muốn
    io.emit("notificationBroadcast", { userId, title, message, type, meta, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Socket emit error:", err?.message || err);
  }

  // 4. SEND TELEGRAM MESSAGE
  try {
    const user = await User.findById(userId).select("telegramChatId");
    if (user?.telegramChatId) {
      await sendTelegramMessage(user.telegramChatId, title, message);
    }
  } catch (err) {
    console.error("Telegram notify error:", err?.message || err);
  }

  return notification;
}

/**
 * getCachedNotifications(userId)
 * - lấy từ Redis, nếu ko có thì read DB (caller logic)
 */
export async function getCachedNotifications(userId, limit = 50) {
  try {
    const key = `notifications:${String(userId)}`;
    const items = await redis.lrange(key, 0, limit - 1);
    if (!items || items.length === 0) return [];
    return items.map((s) => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    console.error("getCachedNotifications error:", err?.message || err);
    return [];
  }
}

