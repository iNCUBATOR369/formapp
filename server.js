// server.js
import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL; // https://formapp-xvb0.onrender.com

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --- вспомогалки
async function tgSendMessage(chat_id, text, extra = {}) {
  return axios.post(`${API}/sendMessage`, { chat_id, text, ...extra }).then(r => r.data);
}
async function tgAnswerWebAppQuery(query_id, title, message) {
  return axios.post(`${API}/answerWebAppQuery`, {
    web_app_query_id: query_id,
    result: {
      type: "article",
      id: String(Date.now()),
      title,
      input_message_content: { message_text: message }
    }
  }).then(r => r.data);
}
async function tgSetWebhook() {
  try {
    const url = `${PUBLIC_URL}/tg`;
    await axios.post(`${API}/setWebhook`, { url });
    console.log("✅ Webhook set to:", url);
  } catch (e) {
    console.error("❌ setWebhook error:", e?.response?.data || e.message);
  }
}

// --- единственная точка: и вебхук Telegram, и запросы из WebApp
app.post("/tg", async (req, res) => {
  const body = req.body;

  try {
    // 1) если это апдейт Telegram (есть update_id)
    if (Object.prototype.hasOwnProperty.call(body, "update_id")) {
      const msg = body.message;
      const cq  = body.callback_query;

      // web_app_data (режим "скрепка → web app")
      if (msg?.web_app_data?.data) {
        // данные приходят строкой — передадим как есть
        const text = msg.web_app_data.data;
        await tgSendMessage(msg.chat.id, `Got it: ${text}`);
        return res.sendStatus(200);
      }

      if (msg?.text) {
        const t = msg.text.trim();
        if (t === "/start") {
          // дадим кнопку открытия WebApp в меню и attach (reply)
          await tgSendMessage(msg.chat.id, "Welcome to FormApp 👋\nTap the button below to open the mini app.", {
            reply_markup: {
              inline_keyboard: [[{ text: "Web App", web_app: { url: PUBLIC_URL } }]],
              keyboard: [[{ text: "Open FormApp", web_app: { url: PUBLIC_URL } }]],
              resize_keyboard: true
            }
          });
          return res.sendStatus(200);
        }
        if (t === "/ping") {
          await tgSendMessage(msg.chat.id, "pong");
          return res.sendStatus(200);
        }
        // любое текстовое
        await tgSendMessage(msg.chat.id, `You wrote: ${t}`);
        return res.sendStatus(200);
      }

      // на всякий случай: колбэки нам сейчас не нужны
      if (cq) return res.sendStatus(200);

      return res.sendStatus(200);
    }

    // 2) иначе — это запрос из WebApp (наша форма)
    const { text, chatId, userId, queryId } = body;
    const message = `This message came from the Mini App!\n\n${text || ""}`.trim();

    if (queryId) {
      // инлайн-кнопка в сообщении
      await tgAnswerWebAppQuery(queryId, "FormApp", message);
      return res.json({ ok: true });
    }

    const target = chatId || userId;
    if (target) {
      await tgSendMessage(target, message);
      return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "No recipient" });
  } catch (e) {
    console.error("Handler error:", e?.response?.data || e.message);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// корневая страница
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`HTTP server on ${PORT}`);
  tgSetWebhook();
});
