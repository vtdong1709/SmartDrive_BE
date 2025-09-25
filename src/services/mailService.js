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

  await transporter.sendMail(mailOptions);
};
