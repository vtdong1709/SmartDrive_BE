import { errorResponse } from "../utils/apiResponse.js";

export function validateRegister(req, res, next) {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json(errorResponse("Thiếu thông tin bắt buộc", 400));
  }

  const fullNameRegex = /^[A-Za-zÀ-ỹ\s]{2,50}$/
  if(!fullNameRegex.test(fullName)) {
    return res.status(400).json(errorResponse("Tên phải có ít nhất 2 kí tự, và chỉ chứa chữ cái", 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json(errorResponse("Email không hợp lệ", 400));
  }

  if (phone && !/^(0[3|5|7|8|9])[0-9]{8}$/.test(phone)) {
    return res
      .status(400)
      .json(errorResponse("Số điện thoại không hợp lệ", 400));
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json(errorResponse("Mật khẩu phải ít nhất 6 ký tự", 400));
  }

  next();
}
