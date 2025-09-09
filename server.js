// server.js — webhook + прием web_app_data. Никаких внешних эндпоинтов.

const path = require("path");
const express = require("express");
const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const PORT = process.env.PORT || 10000;

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error("ENV error: BOT_TOKEN и/или PUBLIC_URL не заданы");
  process.exit(1);
}

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// user.id -> chat.id (чтобы отвечать в правильный чат)
const userToChat = new Map();

bot.start(async (ctx) => {
  if (ctx.from && ctx.chat) userToChat.set(ctx.from.id, ctx.chat.id);
  await ctx.reply(
    "Welcome to FormApp 👋\nTap the button below to open the mini app.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Web App", web_app: { url: `${PUBLIC_URL}/` } }]
        ]
      }
    }
  );
});

bot.command("ping", (ctx) => ctx.reply("pong"));

// Любое входящее сообщение фиксирует связку user->chat
bot.on("message", async (ctx) => {
  if (ctx.from && ctx.chat) userToChat.set(ctx.from.id, ctx.chat.id);

  // Пришли данные из мини-аппа?
  const wa = ctx.message && ctx.message.web_app_data;
  if (wa && wa.data) {
    let payload = {};
    try {
      payload = JSON.parse(wa.data);
    } catch {
      payload = { text: wa.data };
    }
    const text = (payload.text || "").trim() || "(empty)";
    await ctx.reply(`You wrote: ${text}`);
  }
});

// Webhook
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bot.webhookCallback("/tg"));

// Статика мини-аппа
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, async () => {
  try {
    await bot.telegram.setWebhook(`${PUBLIC_URL}/tg`);
    console.log("HTTP server on", PORT);
    console.log("Webhook set to", `${PUBLIC_URL}/tg`);
    console.log("Primary URL:", PUBLIC_URL);
  } catch (err) {
    console.error("Failed to set webhook:", err);
  }
});
