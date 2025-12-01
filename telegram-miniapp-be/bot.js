require("dotenv").config();
const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Lệnh /start để mở Mini App
bot.start((ctx) => {
  ctx.reply("Mở ứng dụng SmartDrive:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open SmartDrive Mini App",
            web_app: { url: "https://smartdrive-webapp.vercel.app" }
          }
        ]
      ]
    }
  });
});

// Bot chạy
bot.launch();
console.log("Bot is running...");
