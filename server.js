import express from "express";
import { Telegraf } from "telegraf";

const { BOT_TOKEN, PUBLIC_URL, PORT = 10000 } = process.env;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is not set");
  process.exit(1);
}
if (!PUBLIC_URL) {
  console.error("❌ PUBLIC_URL is not set");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 9000 });

// ===== Команды =====
bot.start(async (ctx) => {
  const url = PUBLIC_URL; // корень, там раздаём Mini App

  await ctx.reply(
    "Welcome to FormApp 👋\nTap the button below to open the mini app.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Web App",
              web_app: { url }
            }
          ]
        ]
      }
    }
  );
});

bot.command("ping", (ctx) => ctx.reply("pong"));

// Приходят данные из Mini App через sendData(...)
bot.on("message", async (ctx) => {
  const m = ctx.message;
  if (m?.web_app_data?.data) {
    try {
      const payload = JSON.parse(m.web_app_data.data);
      const txt = payload?.text ?? "(empty)";
      await ctx.reply(
        `Got it: ${txt}\n(via Mini App, ts:${payload?.ts ?? Date.now()})`
      );
    } catch {
      await ctx.reply(`Got raw data: ${m.web_app_data.data}`);
    }
    return;
  }
});

// ===== Express + Webhook =====
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Раздаём фронт
app.use(express.static("public", { extensions: ["html"] }));

// Хелсчеки
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// Подключаем вебхук Telegraf
const webhookPath = "/tg";
app.use(bot.webhookCallback(webhookPath));

// Запускаем HTTP и выставляем вебхук
app.listen(PORT, async () => {
  const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}${webhookPath}`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log("✅ HTTP server on", PORT);
    console.log("✅ Webhook set to:", webhookUrl);
    console.log("✅ Primary URL:", PUBLIC_URL);
  } catch (e) {
    console.error("❌ setWebhook failed:", e?.response?.description || e);
    process.exit(1);
  }
});
