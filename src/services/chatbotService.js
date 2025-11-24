import { GoogleGenerativeAI } from "@google/generative-ai";
import redis from "../redis.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt để giới hạn chatbot chỉ trả lời về app
const SYSTEM_PROMPT = `Bạn là trợ lý ảo thông minh của ứng dụng SmartDrive - một ứng dụng cho thuê xe điện (EV Rental System).

Nhiệm vụ của bạn là trả lời các câu hỏi của người dùng về ứng dụng SmartDrive. Bạn CHỈ được trả lời các câu hỏi liên quan đến:
- Cách sử dụng ứng dụng SmartDrive
- Cách đăng ký tài khoản
- Cách đăng nhập
- Bảng giá dịch vụ
- Cách đặt xe
- Cách thanh toán
- Cách trở thành tài xế
- Các tính năng của ứng dụng
- Chính sách và quy định
- Hỗ trợ kỹ thuật cơ bản

Nếu người dùng hỏi về các chủ đề KHÔNG liên quan đến ứng dụng SmartDrive (ví dụ: thời tiết, tin tức, kiến thức chung, v.v.), bạn cần lịch sự từ chối và hướng dẫn họ quay lại các câu hỏi về ứng dụng.

Hãy trả lời một cách thân thiện, chuyên nghiệp và bằng tiếng Việt.`;

/**
 * Lấy lịch sử chat từ Redis
 */
const getChatHistory = async (sessionId) => {
  try {
    const history = await redis.get(`chatbot:${sessionId}`);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
};

/**
 * Lưu lịch sử chat vào Redis
 */
const saveChatHistory = async (sessionId, messages, maxHistory = 20) => {
  try {
    // Giới hạn số lượng tin nhắn để tránh tốn bộ nhớ
    const limitedMessages = messages.slice(-maxHistory);
    await redis.setex(
      `chatbot:${sessionId}`,
      86400 * 7, // Lưu 7 ngày
      JSON.stringify(limitedMessages)
    );
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
};

/**
 * Xóa lịch sử chat
 */
const clearChatHistory = async (sessionId) => {
  try {
    await redis.del(`chatbot:${sessionId}`);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
};

/**
 * Chuyển đổi lịch sử chat từ format OpenAI sang format Gemini
 */
const convertHistoryToGeminiFormat = (history) => {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
};

/**
 * Gửi tin nhắn đến chatbot và nhận phản hồi
 */
export const sendMessage = async (sessionId, userMessage) => {
  try {
    // Lấy lịch sử chat
    let chatHistory = await getChatHistory(sessionId);

    // Khởi tạo model Gemini
    // Sử dụng gemini-1.5-flash (nhanh và rẻ) hoặc gemini-1.5-pro (chất lượng cao hơn)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
    });

    // Chuẩn bị lịch sử chat cho Gemini
    let geminiHistory = [];
    
    // Nếu chưa có lịch sử, thêm system prompt vào đầu conversation
    if (chatHistory.length === 0) {
      // Thêm system prompt như một cặp user-model để model hiểu context
      geminiHistory = [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Tôi hiểu rồi. Tôi sẽ chỉ trả lời các câu hỏi về ứng dụng SmartDrive. Bạn cần hỗ trợ gì?" }],
        },
      ];
    } else {
      // Chuyển đổi lịch sử chat sang format Gemini
      geminiHistory = convertHistoryToGeminiFormat(chatHistory);
    }

    // Tạo chat session với lịch sử
    const chat = model.startChat({
      history: geminiHistory,
    });

    // Gửi tin nhắn và nhận phản hồi
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const assistantMessage = response.text();

    // Cập nhật lịch sử chat (format OpenAI để tương thích với code hiện tại)
    // Chỉ lưu user message và assistant response, không lưu system prompt
    chatHistory.push(
      {
        role: "user",
        content: userMessage,
      },
      {
        role: "assistant",
        content: assistantMessage,
      }
    );

    // Lưu lịch sử chat
    await saveChatHistory(sessionId, chatHistory);

    return assistantMessage;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw new Error(
      error.message || "Có lỗi xảy ra khi xử lý tin nhắn. Vui lòng thử lại sau."
    );
  }
};

/**
 * Xóa lịch sử chat của một session
 */
export const clearHistory = async (sessionId) => {
  await clearChatHistory(sessionId);
};

/**
 * Lấy lịch sử chat của một session
 */
export const getHistory = async (sessionId) => {
  return await getChatHistory(sessionId);
};

