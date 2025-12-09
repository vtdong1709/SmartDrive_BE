// require("dotenv").config();
// const { Telegraf } = require("telegraf");

// const bot = new Telegraf(process.env.BOT_TOKEN);

// // Lệnh /start để mở Mini App
// bot.start((ctx) => {
//   ctx.reply("Mở ứng dụng SmartDrive:", {
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: "Open SmartDrive Mini App",
//             web_app: { url: "https://smartdrive-webapp.vercel.app" }
//           }
//         ]
//       ]
//     }
//   });
// });

// // Bot chạy
// bot.launch();
// console.log("Bot is running...");
require("dotenv").config();
const { Telegraf } = require("telegraf");
const express = require("express");
const axios = require("axios");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.use(express.json());

// ======== CẤU HÌNH ========

const MINI_APP_URL = process.env.MINI_APP_URL;
const MAIN_BE_API = process.env.MAIN_BE_API;

// ======== /start ========

bot.start(async (ctx) => {
  try {
    const chatId = String(ctx.chat.id);
    const telegramId = String(ctx.from.id);
    const username = ctx.from.username || "";

    // Gửi thông tin user về BE chính
    await axios.post(`${MAIN_BE_API}/api/users/link-telegram`, {
      telegramId,
      chatId,
      username
    });

    // Menu chính
    await ctx.reply("🚗 Chào mừng bạn đến SmartDrive", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Mở SmartDrive App",
              web_app: { url: MINI_APP_URL }
            }
          ]
        ]
      }
    });

    // Xin quyền vị trí
    await ctx.reply("Vui lòng chia sẻ vị trí:", {
      reply_markup: {
        keyboard: [
          [
            {
              text: "📡 Gửi vị trí hiện tại",
              request_location: true
            }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } catch (err) {
    console.error("Start error:", err?.message);
    ctx.reply("Có lỗi khi kết nối với hệ thống SmartDrive");
  }
});

// ======== Nhận vị trí ========

bot.on("location", async (ctx) => {
  try {
    const { latitude, longitude } = ctx.message.location;

    await ctx.reply("Đã nhận vị trí của bạn!");

    // Gửi lại nút mở app
    await ctx.reply("Mở SmartDrive App:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Mở SmartDrive",
              web_app: { url: MINI_APP_URL }
            }
          ]
        ]
      }
    });
  } catch (err) {
    console.error("Location error:", err?.message);
  }
});

// ======== Inline mode (@smartdrive_backup_bot) ========

bot.on("inline_query", async (ctx) => {
  try {
    const results = [
      {
        type: "article",
        id: "smartdrive_open",
        title: "🚗 Mở SmartDrive App",
        input_message_content: {
          message_text: "Nhấn để mở SmartDrive"
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Open SmartDrive",
                web_app: { url: MINI_APP_URL }
              }
            ]
          ]
        }
      }
    ];

    await ctx.answerInlineQuery(results, { cache_time: 1 });
  } catch (err) {
    console.error("Inline error:", err?.message);
  }
});

// ======== API để BE chính gọi gửi notification ========

app.post("/send", async (req, res) => {
  const { chatId, text } = req.body;

  if (!chatId || !text) {
    return res.status(400).json({ error: "Missing chatId or text" });
  }

  try {
    await bot.telegram.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 Mở SmartDrive App",
              web_app: { url: MINI_APP_URL }
            }
          ]
        ]
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Send API error:", err?.message);
    res.status(500).json({ error: err.message });
  }
});

// ======== CHẠY SERVER ========

const PORT = 5005;

app.listen(PORT, () => {
  console.log(`Bot API running at http://localhost:${PORT}`);
});

bot.launch();
console.log("Telegram bot is running...");
