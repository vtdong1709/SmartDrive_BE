import { GoogleGenerativeAI } from "@google/generative-ai";
import redis from "../redis.js";
import { formatChatbotDataForPrompt } from "./chatbotDataService.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Tạo system prompt với dữ liệu thật từ database
 */
const createSystemPrompt = async () => {
  // Lấy dữ liệu thật từ database
  const databaseInfo = await formatChatbotDataForPrompt();
  
  const basePrompt = `Bạn là trợ lý ảo thông minh của ứng dụng SmartDrive.

SmartDrive là một ứng dụng cho thuê xe tài xế lái xe hộ (KHÔNG phải tự lái). Khi người dùng hỏi "SmartDrive là gì" hoặc câu hỏi tương tự, bạn PHẢI trả lời dựa trên thông tin từ database được cung cấp bên dưới, không được dùng kiến thức chung.

🚨 QUY TẮC QUAN TRỌNG NHẤT - BẮT BUỘC PHẢI TUÂN THEO:

1. BẠN PHẢI TRẢ LỜI 100% DỰA TRÊN THÔNG TIN TỪ DATABASE ĐƯỢC CUNG CẤP BÊN DƯỚI
2. KHÔNG ĐƯỢC sử dụng kiến thức chung, kinh nghiệm cá nhân, hoặc thông tin từ nguồn khác
3. SmartDrive là một ứng dụng cho thuê xe tài xế lái xe hộ, không phải tự lái.
4. KHÔNG ĐƯỢC tự ý thêm, bớt, hoặc thay đổi bất kỳ thông tin nào về:
   - Giá cả (phải dùng đúng giá từ database)
   - Quy trình đăng ký/đăng nhập (phải dùng đúng quy trình từ database)
   - Cách đặt xe (phải dùng đúng quy trình từ database)
   - Yêu cầu, điều kiện (phải dùng đúng từ database)
5. Khi người dùng hỏi về bảng giá:
   - BẮT BUỘC phải liệt kê đầy đủ các loại dịch vụ và giá từ database
   - BẮT BUỘC phải dùng đúng số tiền, đơn vị giá từ database
   - BẮT BUỘC phải dùng tên dịch vụ bằng tiếng Việt: "Theo km", "Theo giờ", "Theo ngày", "Đi tỉnh" thay vì code như "per_km", "hourly", "daily", "intercity"
   - KHÔNG được ước lượng hoặc làm tròn
6. Khi người dùng hỏi về cách đăng ký:
   - BẮT BUỘC phải trả lời theo đúng quy trình trong database
   - BẮT BUỘC phải liệt kê đầy đủ yêu cầu từ database
   - KHÔNG được trả lời theo cách đăng ký chung chung
7. Khi người dùng hỏi về cách đặt xe:
   - BẮT BUỘC phải trả lời theo đúng quy trình trong database
   - BẮT BUỘC phải nêu rõ yêu cầu theo từng loại dịch vụ từ database
   - BẮT BUỘC phải dùng tên dịch vụ bằng tiếng Việt: "Theo km", "Theo giờ", "Theo ngày", "Đi tỉnh"
9. Khi người dùng hỏi "SmartDrive là gì" hoặc câu hỏi tương tự:
   - BẮT BUỘC phải trả lời dựa trên thông tin từ database (phần "SMARTDRIVE LÀ GÌ")
   - PHẢI nói rõ: "SmartDrive là ứng dụng cho thuê xe tài xế lái xe hộ (KHÔNG phải tự lái)"
   - PHẢI liệt kê các tính năng và đối tượng từ database
8. Nếu không có thông tin trong database, bạn PHẢI nói: "Xin lỗi, tôi không có thông tin về câu hỏi của bạn trong hệ thống. Vui lòng liên hệ nhân viên tư vấn để được hỗ trợ."

Nếu người dùng hỏi về các chủ đề KHÔNG liên quan đến ứng dụng SmartDrive (ví dụ: thời tiết, tin tức, kiến thức chung, câu hỏi về công ty khác, v.v.), bạn cần:
1. Lịch sự từ chối: "Xin lỗi, tôi chỉ có thể trả lời các câu hỏi về ứng dụng SmartDrive."
2. Hướng dẫn: "Vui lòng liên hệ nhân viên tư vấn để được hỗ trợ về các vấn đề khác."
3. Không trả lời câu hỏi ngoài phạm vi SmartDrive

Hãy trả lời một cách thân thiện, chuyên nghiệp và bằng tiếng Việt.`;

  return basePrompt + databaseInfo;
};

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

    // Tạo system prompt với dữ liệu thật từ database
    const systemPrompt = await createSystemPrompt();

    // Khởi tạo model Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
    });

    // Chuẩn bị lịch sử chat cho Gemini
    let geminiHistory = [];
    
    // Lấy dữ liệu database để thêm vào context mỗi lần
    const databaseInfo = await formatChatbotDataForPrompt();
    
    // Nếu chưa có lịch sử, thêm system prompt vào đầu conversation
    if (chatHistory.length === 0) {
      // Thêm system prompt như một cặp user-model để model hiểu context
      geminiHistory = [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Tôi hiểu rồi. Tôi sẽ trả lời các câu hỏi về ứng dụng SmartDrive dựa trên thông tin chính xác từ database. Bạn cần hỗ trợ gì?" }],
        },
      ];
    } else {
      // Chuyển đổi lịch sử chat sang format Gemini
      geminiHistory = convertHistoryToGeminiFormat(chatHistory);
    }
    
    // Thêm nhắc nhở về database vào tin nhắn của user
    const enhancedUserMessage = `${userMessage}\n\n[LƯU Ý: Hãy trả lời dựa trên thông tin từ database được cung cấp. Nếu câu hỏi về bảng giá, cách đăng ký, cách đặt xe, v.v., bạn PHẢI dùng đúng thông tin từ database, không được dùng kiến thức chung.]\n\n${databaseInfo}`;

    // Tạo chat session với lịch sử
    const chat = model.startChat({
      history: geminiHistory,
    });

    // Gửi tin nhắn và nhận phản hồi (với enhanced message có database info)
    const result = await chat.sendMessage(enhancedUserMessage);
    const response = await result.response;
    let assistantMessage = response.text();

    // Kiểm tra xem câu hỏi có ngoài phạm vi SmartDrive không
    // Nếu chatbot không từ chối rõ ràng, có thể cần xử lý thêm
    const lowerMessage = userMessage.toLowerCase();
    const isOffTopic = 
      lowerMessage.includes("thời tiết") ||
      lowerMessage.includes("tin tức") ||
      lowerMessage.includes("giá vàng") ||
      lowerMessage.includes("tỷ giá") ||
      (lowerMessage.includes("công ty") && !lowerMessage.includes("smartdrive")) ||
      (lowerMessage.includes("app") && !lowerMessage.includes("smartdrive"));

    // Nếu câu hỏi ngoài phạm vi và chatbot chưa từ chối rõ ràng
    if (isOffTopic && !assistantMessage.includes("nhân viên tư vấn") && !assistantMessage.includes("chỉ có thể trả lời")) {
      assistantMessage = `Xin lỗi, tôi chỉ có thể trả lời các câu hỏi về ứng dụng SmartDrive. Vui lòng liên hệ nhân viên tư vấn để được hỗ trợ về các vấn đề khác.`;
    }

    // Cập nhật lịch sử chat (format OpenAI để tương thích với code hiện tại)
    // Chỉ lưu user message gốc (không có enhanced) và assistant response, không lưu system prompt
    chatHistory.push(
      {
        role: "user",
        content: userMessage, // Lưu message gốc, không lưu enhanced
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

