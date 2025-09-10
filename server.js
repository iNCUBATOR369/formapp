import express from "express";
import fetch from "node-fetch";
import TelegramBot from "node-telegram-bot-api";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error("❌ Missing BOT_TOKEN or PUBLIC_URL");
  process.exit(1);
}

const app = express();
app.use(express.json());

// --- Telegram bot (webhook) ---
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const WEBHOOK_PATH = `/tg/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

async function ensureWebhook() {
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== WEBHOOK_URL) {
      await bot.setWebHook(WEBHOOK_URL);
      console.log("✅ Webhook set:", WEBHOOK_URL);
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

// --- команды ---
bot.onText(/^\/start\b/i, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "Welcome to FormApp 👋\nTap below to open Mini App",
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Open FormApp",
              web_app: { url: PUBLIC_URL }
            }
          ]
        ],
        resize_keyboard: true
      }
    }
  );
});

bot.onText(/^\/ping\b/i, (msg) => {
  bot.sendMessage(msg.chat.id, "pong");
});

// --- web_app_data (из sendData) ---
bot.on("message", async (msg) => {
  if (msg.web_app_data?.data) {
    let text = msg.web_app_data.data;
    try {
      const parsed = JSON.parse(text);
      if (parsed.text) text = parsed.text;
    } catch {}
    await bot.sendMessage(msg.chat.id, `Got it: ${text}`);
  }
});

// --- ручка для Web App (fetch -> Telegram) ---
app.post("/tg/send", async (req, res) => {
  try {
    const { chat_id, text } = req.body || {};
    if (!chat_id || !text) {
      return res.status(400).json({ ok: false, description: "Missing chat_id or text" });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text })
    });

    const data = await tgRes.json();
    return res.status(tgRes.ok ? 200 : 500).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, description: err.message });
  }
});

// --- статика ---
app.use(express.static("public"));
app.get("/", (_req, res) => res.send("FormApp is live"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server on ${PORT}`);
});
