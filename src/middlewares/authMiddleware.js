import User from "../models/User.js";
import { verifyAccessToken } from "../utils/jwtHandler.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized, vui lòng nhập token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ message: "Không tìm thấy người dùng hợp lệ." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token không hợp lệ hoặc quá hạn." });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Tài khoản không được phép truy cập." });
    }
    next();
  };
};
