import { getTransporter } from "../config/mailConfig.js";
import Notification from "../models/Notification.js";
import { io } from "../../server.js";
import { userSockets } from "../sockets/socketHandler.js";

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
 * Tạo và gửi thông báo (email + real-time)
 * @param {string} userId - ID của người nhận
 * @param {string} title - Tiêu đề thông báo
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo
 * @param {object} mailOptions - Tùy chọn để gửi email (nếu có)
 * @param {string} mailOptions.to - Email người nhận
 * @param {string} mailOptions.subject - Chủ đề email
 * @param {string} mailOptions.body - Nội dung email (HTML)
 */
export const createAndSendNotification = async (userId, title, message, type, mailOptions) => {
  try {
    // 1. Lưu thông báo vào DB
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
    });

    // 2. Gửi thông báo real-time qua Socket.IO
    const userSocketId = userSockets.get(userId.toString());
    if (userSocketId) {
      io.to(userSocketId).emit("newNotification", notification);
      console.log(`Sent real-time notification to user ${userId}`);
    }

    // 3. Gửi email nếu có thông tin
    if (mailOptions && mailOptions.to) {
      const transporter = getTransporter();
      const html = baseTemplate({ title: mailOptions.subject, body: mailOptions.body });
      await transporter.sendMail({
        from: `SmartDrive <${process.env.SMTP_USER}>`,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html,
      });
      console.log(`Sent email notification to ${mailOptions.to}`);
    }

    return notification;
  } catch (error) {
    console.error("Failed to create and send notification:", error);
  }
};