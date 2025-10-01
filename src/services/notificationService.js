import { getTransporter } from "../config/mailConfig.js";

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



