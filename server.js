import express from "express";
import TelegramBot from "node-telegram-bot-api";

const TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL; // например: https://formapp-xvb0.onrender.com  (без слэша на конце!)

if (!TOKEN || !PUBLIC_URL) {
  console.error("❌ Set BOT_TOKEN and PUBLIC_URL env vars");
  process.exit(1);
}

const app = express();
app.use(express.json());

// --- Telegram bot in webhook mode ---
const bot = new TelegramBot(TOKEN, { webHook: true });

// Вебхук будет: https://<host>/tg/<token>
const WEBHOOK_PATH = `/tg/${TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

async function ensureWebhook() {
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== WEBHOOK_URL) {
      await bot.setWebHook(WEBHOOK_URL);
      console.log("✅ Webhook set to:", WEBHOOK_URL);
    } else {
      console.log("ℹ️ Webhook already set:", WEBHOOK_URL);
    }
  } catch (e) {
    console.error("Webhook error:", e.message);
  }
}
await ensureWebhook();

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Команды ---
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  const kb = {
    keyboard: [
      [
        {
          text: "Open FormApp",
          web_app: { url: PUBLIC_URL } // открытие мини-аппа из обычного меню
        }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  await bot.sendMessage(
    chatId,
    "Welcome to FormApp 👋\nTap the button below to open the mini app.",
    { reply_markup: kb }
  );
});

bot.onText(/^\/ping\b/i, (msg) => {
  bot.sendMessage(msg.chat.id, "pong");
});

// Приход данных из мини-аппа (из Menu и из правой кнопки «Open FormApp»):
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  // Если мини-апп прислал данные
  if (msg.web_app_data && msg.web_app_data.data) {
    let text = msg.web_app_data.data;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed.text) text = parsed.text;
    } catch (_) {
      // оставляем как есть
    }

    await bot.sendMessage(chatId, `Got it from Mini App: ${text}`);
  }
});

// --- статика мини-аппа ---
app.use(express.static("public"));

// живой корень (health check)
app.get("/", (_req, res) => {
  res.send("FormApp is live");
});

// Render ожидает 10000/0.0.0.0
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server on ${PORT}`);
});
