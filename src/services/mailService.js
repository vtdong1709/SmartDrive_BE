import { getTransporter } from "../config/mailConfig.js";
import { otpTemplate } from "../config/mailTemplate.js";

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
