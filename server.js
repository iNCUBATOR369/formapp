// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Telegraf } from "telegraf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === ENV ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/+$/, ""); // без завершающего /
if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error("ENV required: BOT_TOKEN, PUBLIC_URL");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === BOT ===
const bot = new Telegraf(BOT_TOKEN);

// 0) Лёгкий лог, чтобы в Render -> Logs видеть входящие апдейты
bot.use(async (ctx, next) => {
  const t = ctx.updateType;
  const txt = ctx.message?.text;
  const webData = ctx.message?.web_app_data?.data;
  if (txt || webData) {
    console.log("Incoming:", { type: t, text: txt, web_app_data: webData ? "[present]" : "" });
  } else {
    console.log("Incoming:", { type: t });
  }
  return next();
});

// 1) /start — дубль: и .start и явная команда
const showWelcome = async (ctx) => {
  const webAppUrl = `${PUBLIC_URL}/`;
  return ctx.reply(
    "Welcome to FormApp 👋\nTap the button below to open the mini app.",
    {
      reply_markup: {
        keyboard: [[{ text: "Web App", web_app: { url: webAppUrl } }]],
        resize_keyboard: true,
        is_persistent: true,
      },
    }
  );
};
bot.start(showWelcome);
bot.command("start", showWelcome);

// 2) /ping
bot.command("ping", (ctx) => ctx.reply("pong"));

// 3) web_app_data из Open FormApp (sendData)
bot.on("message", async (ctx, next) => {
  const data = ctx.message?.web_app_data?.data;
  if (data) {
    let payload = data;
    try { payload = JSON.parse(data); } catch (_) {}
    const text = payload?.text ? String(payload.text) : String(payload);
    await ctx.reply(`Got it: ${text}`);
    return; // эту ветку обработали — выходим
  }
  return next(); // другим хендлерам
});

// === STATIC (Web App) ===
app.use(express.static(path.join(__dirname, "public")));

// 4) Web App -> сервер (надёжная отправка из левой кнопки)
app.post("/api/webapp", async (req, res) => {
  try {
    const { userId, text } = req.body || {};
    if (!userId || !text) return res.status(400).json({ ok: false, error: "userId and text are required" });
    await bot.telegram.sendMessage(userId, `You wrote: ${text}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error("/api/webapp error:", e);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});

// healthcheck
app.get("/healthz", (_, res) => res.send("OK"));

// === WEBHOOK ===
const WEBHOOK_PATH = "/tg";
app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`HTTP server on ${PORT}`);
  const target = `${PUBLIC_URL}${WEBHOOK_PATH}`;
  try {
    await bot.telegram.setWebhook(target, {
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    console.log("Webhook set to:", target);
    console.log("Primary URL:", PUBLIC_URL);
  } catch (e) {
    console.error("setWebhook error:", e);
  }
});
