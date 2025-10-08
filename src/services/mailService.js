import { getTransporter } from "../config/mailConfig.js";
import { otpTemplate } from "../config/mailTemplate.js";
import { welcomeTemplate } from "../config/mailTemplate.js";

export const sendOtpEmail = async ({ to, name, otpCode, type }) => {
  const transporter = getTransporter();

  let subject;
  switch (type) {
    case "verify_email":
      subject = "Mã OTP xác thực email";
      break;
    case "reset_password":
      subject = "Bạn đã yêu cầu đổi mật khẩu";
      break;
    default:
      subject = "Mã OTP";
  }

  const mailOptions = {
    from: `Quản trị viên EV Rental <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: otpTemplate({ name, otp: otpCode }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("SMTP sendMail accepted:", info.accepted);
    if (info.rejected && info.rejected.length) {
      console.warn("SMTP sendMail rejected:", info.rejected);
    }
    return info;
  } catch (err) {
    console.error("SMTP sendMail error:", err?.message || err);
    
    throw err;
  }
};

export const sendWelcomeEmail = async ({ to, name }) => {
  console.log(`Sending welcome email to ${to}`);
  const transporter = getTransporter();

  const mailOptions = {
    from: `SmartDrive <${process.env.SMTP_USER}>`,
    to,
    subject: "Chào mừng bạn đến với SmartDrive!",
    html: welcomeTemplate({ name }),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${to}`);
  } catch (err) {
    // Ghi log lỗi chi tiết hơn để dễ dàng debug
    console.error("================ LỖI GỬI EMAIL CHÀO MỪNG ================");
    console.error(`- Thời gian: ${new Date().toISOString()}`);
    console.error(`- Đến email: ${to}`);
    console.error(`- Lỗi: ${err.message}`);
    console.error("- Chi tiết lỗi:", err);
    console.error("=========================================================");
    // Không re-throw lỗi để tránh làm gián đoạn luồng chính
  }
};
