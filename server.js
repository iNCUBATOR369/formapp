// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Telegraf, Markup } from "telegraf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === ENV ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/+$/, ""); // без завершающего /
if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error("ENV required: BOT_TOKEN, PUBLIC_URL");
  process.exit(1);
}

// === TELEGRAM BOT ===
const bot = new Telegraf(BOT_TOKEN);

// /start: показываем кнопку Web App и подсказку про Open FormApp
bot.start(async (ctx) => {
  const webAppUrl = `${PUBLIC_URL}/`; // наш мини-апп
  await ctx.reply(
    "Welcome to FormApp 👋\nTap the button below to open the mini app.",
    {
      reply_markup: {
        keyboard: [
          [{ text: "Web App", web_app: { url: webAppUrl } }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      },
    }
  );
});

// /ping
bot.command("ping", (ctx) => ctx.reply("pong"));

// Получение данных, отправленных из мини-аппа через sendData (Open FormApp)
bot.on("message", async (ctx, next) => {
  try {
    const msg = ctx.message;
    if (msg?.web_app_data?.data) {
      // данные, пришедшие через tg.sendData(...)
      let payload = msg.web_app_data.data;
      try { payload = JSON.parse(payload); } catch (_) {}
      const text = (payload && payload.text) ? String(payload.text) : String(payload || "");
      await ctx.reply(`Got it: ${text}`);
      return;
    }
  } catch (e) {
    console.error("web_app_data handler error:", e);
  }
  return next();
});

// === EXPRESS APP ===
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// раздаём мини-апп
app.use(express.static(path.join(__dirname, "public")));

// health
app.get("/healthz", (_, res) => res.send("OK"));

// Маршрут для отправки из Web App напрямую на сервер
// ТРЕБУЕТСЯ только userId и text (валидацию можно добавить позже)
app.post("/api/webapp", async (req, res) => {
  try {
    const { userId, text } = req.body || {};
    if (!userId || !text) {
      return res.status(400).json({ ok: false, error: "userId and text are required" });
    }
    await bot.telegram.sendMessage(userId, `You wrote: ${text}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error("/api/webapp error:", e);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});

// вебхук
const WEBHOOK_PATH = "/tg";
app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

// стартуем
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`HTTP server on ${PORT}`);
  const target = `${PUBLIC_URL}${WEBHOOK_PATH}`;
  try {
    await bot.telegram.setWebhook(target);
    console.log("Webhook set to:", target);
    console.log("Primary URL:", PUBLIC_URL);
  } catch (e) {
    console.error("setWebhook error:", e);
  }
});
