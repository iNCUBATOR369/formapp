import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/+$/, ""); // без "/" в конце

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error("❌ BOT_TOKEN или PUBLIC_URL не заданы в переменных окружения");
  process.exit(1);
}

const TG = axios.create({
  baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`
});

// ─────────────────────────  Webhook  ─────────────────────────
const WEBHOOK_PATH = "/tg";
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

async function setWebhook() {
  try {
    await TG.post("/setWebhook", { url: WEBHOOK_URL });
    console.log("✅ Webhook set to:", WEBHOOK_URL);
  } catch (e) {
    console.error("❌ setWebhook error:", e.response?.data || e.message);
  }
}

// ─────────────────────────  Bot logic  ─────────────────────────
// единая помощька
function reply(chat_id, text) {
  return TG.post("/sendMessage", { chat_id, text });
}

app.post(WEBHOOK_PATH, async (req, res) => {
  res.sendStatus(200); // сразу 200, чтобы не ждать

  try {
    const update = req.body;

    // 1) Обычные сообщения
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;

      // /start и /ping
      if (msg.text === "/start") {
        await reply(
          chatId,
          "Welcome to FormApp 👋\nTap the button below to open the mini app."
        );
        // подсказка под клавиатурой (Web App кнопка)
        await TG.post("/sendMessage", {
          chat_id: chatId,
          text: "Open the Mini App:",
          reply_markup: {
            inline_keyboard: [[{ text: "Web App", web_app: { url: PUBLIC_URL } }]]
          }
        });
        return;
      }

      if (msg.text === "/ping") {
        await reply(chatId, "pong");
        return;
      }

      // 2) Данные из мини-аппа, отправленные через tg.sendData(...)
      if (msg.web_app_data) {
        const payload = msg.web_app_data.data;
        // пытаемся прочитать как JSON, но это необязательно
        let text = "";
        try {
          const parsed = JSON.parse(payload);
          text =
            parsed?.text ||
            (typeof parsed === "string" ? parsed : "") ||
            String(payload);
        } catch {
          text = String(payload);
        }

        if (!text.trim()) text = "(empty message)";

        await reply(chatId, `Got it: ${text}`);
        return;
      }

      // если другие тексты — молчим/ничего не делаем, чтобы не «болтать»
    }
  } catch (e) {
    console.error("❌ webhook handler error:", e.response?.data || e.message);
  }
});

// ─────────────────────────  Server  ─────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log("HTTP server on", PORT);
  await setWebhook();
  console.log("Primary URL:", PUBLIC_URL);
  console.log("==> Your service is live 🎉");
});
