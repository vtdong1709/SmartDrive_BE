export const otpTemplate = ({ name, otp, type }) => {
  let warningMessage = "";
  if (type === "delete_account") {
    warningMessage = `
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="color: #856404; font-size: 14px; margin: 0; font-weight: bold;">
          ⚠️ CẢNH BÁO: Mã OTP này dùng để xóa tài khoản của bạn. Hành động này không thể hoàn tác!
        </p>
      </div>
    `;
  }

  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f0f4f8; padding: 30px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 40px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #0056b3; text-align: center;">Hệ thống Xác thực</h2>
        <p style="color: #333333; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
        <p style="color: #333333; font-size: 16px;">Mã OTP của bạn là:</p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; padding: 15px 25px; font-size: 24px; font-weight: bold; color: #ffffff; background-color: #007bff; border-radius: 8px; letter-spacing: 4px;">
            ${otp}
          </span>
        </div>
        ${warningMessage}
        <p style="color: #666666; font-size: 14px; text-align: center;">Mã OTP có hiệu lực trong 5 phút.</p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;" />
        <p style="color: #999999; font-size: 12px; text-align: center;">
          Vui lòng không chia sẻ mã OTP này với bất kỳ ai. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.
        </p>
      </div>
    </div>
  `;
};
