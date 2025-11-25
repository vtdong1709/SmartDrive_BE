import { sendMessage, clearHistory, getHistory } from "../services/chatbotService.js";
import { successResponse, errorResponse } from "../utils/apiResponse.js";

/**
 * Gửi tin nhắn đến chatbot
 */
export const chat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res
        .status(400)
        .json(errorResponse("Vui lòng nhập tin nhắn!", 400));
    }

    if (!sessionId) {
      return res
        .status(400)
        .json(errorResponse("Vui lòng cung cấp sessionId!", 400));
    }

    const response = await sendMessage(sessionId, message.trim());

    res.status(200).json(
      successResponse("Tin nhắn đã được xử lý thành công", {
        response,
        sessionId,
      })
    );
  } catch (error) {
    console.error("Error in chat controller:", error);
    res.status(500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        500
      )
    );
  }
};

/**
 * Xóa lịch sử chat
 */
export const clearChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res
        .status(400)
        .json(errorResponse("Vui lòng cung cấp sessionId!", 400));
    }

    await clearHistory(sessionId);

    res
      .status(200)
      .json(successResponse("Đã xóa lịch sử chat thành công", { sessionId }));
  } catch (error) {
    console.error("Error in clearChatHistory controller:", error);
    res.status(500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        500
      )
    );
  }
};

/**
 * Lấy lịch sử chat
 */
export const getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res
        .status(400)
        .json(errorResponse("Vui lòng cung cấp sessionId!", 400));
    }

    const history = await getHistory(sessionId);

    res.status(200).json(
      successResponse("Lấy lịch sử chat thành công", {
        sessionId,
        history,
        count: history.length,
      })
    );
  } catch (error) {
    console.error("Error in getChatHistory controller:", error);
    res.status(500).json(
      errorResponse(
        error.message || "Có lỗi xảy ra, vui lòng thử lại sau",
        500
      )
    );
  }
};

