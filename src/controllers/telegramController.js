import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";
import { linkTelegramAccountService } from "../services/userService.js";

/**
 * Link Telegram account bằng userId (từ client app)
 * Endpoint: POST /api/telegram/link (có authenticate middleware)
 * Lấy userId từ req.user.id (từ JWT token) hoặc từ req.body
 */
export const linkTelegramAccount = async (req, res) => {
  try {
    // Lấy userId từ JWT token (nếu có authenticate) hoặc từ body
    const userId = req.user?.id || req.body.userId;
    const { chatId, username, telegramId } = req.body;

    if (!userId) {
      return res
        .status(400)
        .json(errorResponse("Thiếu userId hoặc chưa đăng nhập", 400));
    }

    if (!chatId) {
      return res
        .status(400)
        .json(errorResponse("Thiếu chatId", 400));
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json(errorResponse("Không tìm thấy người dùng", 404));
    }

    // Cập nhật thông tin Telegram
    const updateData = {
      telegramChatId: chatId,
    };

    if (username) {
      updateData.telegramUsername = username;
    }

    if (telegramId) {
      updateData.telegramId = telegramId;
    }

    await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json(successResponse("Liên kết Telegram thành công"));
  } catch (err) {
    console.error("Link Telegram error:", err);
    res
      .status(err.statusCode || 500)
      .json(
        errorResponse(
          err.message || "Không thể liên kết tài khoản Telegram",
          err.statusCode || 500
        )
      );
  }
};

/**
 * Link Telegram account từ bot (nhận telegramId từ bot)
 * Endpoint: POST /api/users/link-telegram
 */
export const linkTelegramAccountFromBot = async (req, res) => {
  try {
    const { telegramId, chatId, username, userId } = req.body;

    const user = await linkTelegramAccountService({
      telegramId,
      chatId,
      username,
      userId,
    });

    res
      .status(200)
      .json(
        successResponse("Liên kết Telegram thành công", {
          userId: user._id,
          telegramId: user.telegramId,
          telegramChatId: user.telegramChatId,
        })
      );
  } catch (err) {
    console.error("Link Telegram from bot error:", err);
    res
      .status(err.statusCode || 500)
      .json(
        errorResponse(
          err.message || "Không thể liên kết tài khoản Telegram",
          err.statusCode || 500
        )
      );
  }
};
