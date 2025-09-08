// server.js — Webhook-only версия для Render
// Никакого getUpdates/polling — конфликта 409 больше не будет.

require('dotenv').config();
const path = require('path');
const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
let PUBLIC_URL = process.env.PUBLIC_URL; // например: https://formapp-xvb0.onrender.com

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing in env');
  process.exit(1);
}
if (!PUBLIC_URL) {
  console.error('❌ PUBLIC_URL is missing in env');
  process.exit(1);
}
if (PUBLIC_URL.endsWith('/')) PUBLIC_URL = PUBLIC_URL.slice(0, -1);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Telegram Bot =====
const bot = new Telegraf(BOT_TOKEN);

// /start — покажем кнопку открытия Mini App
bot.start(async (ctx) => {
  await ctx.reply(
    'Welcome to FormApp! Tap to open 👇',
    Markup.inlineKeyboard([Markup.button.webApp('Open Mini App', PUBLIC_URL)])
  );
});

// Любой текст — просто эхо
bot.on('text', async (ctx) => {
  await ctx.reply(`You said: ${ctx.message.text}`);
});

// Приём данных из Mini App (sendData)
bot.on('message', async (ctx) => {
  const wa = ctx.message && ctx.message.web_app_data;
  if (!wa) return;
  try {
    // данные из Mini App приходят строкой
    const parsed = JSON.parse(wa.data);
    if (parsed && parsed.type === 'publish' && typeof parsed.text === 'string') {
      // публикуем в чат сообщение
      await ctx.reply(`Mini App says: ${parsed.text}`);
    } else {
      await ctx.reply(`Mini App data: ${wa.data}`);
    }
  } catch {
    await ctx.reply(`Mini App data: ${wa.data}`);
  }
});

// ===== Webhook =====
const WEBHOOK_PATH = `/tg/${BOT_TOKEN}`;
const WEBHOOK_URL = `${PUBLIC_URL}${WEBHOOK_PATH}`;

// Передаём апдейты в Telegraf через webhookCallback
app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

// ===== Статика (мини-приложение) =====
app.use(express.static(path.join(__dirname, 'public')));

// Главная — отдаём public/index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Healthcheck для Render (по желанию)
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

// ===== Запуск HTTP + установка webhook =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🌐 HTTP server on ${PORT}`);

  try {
    // На всякий случай очистим прежний вебхук и зависшие апдейты
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    console.warn('deleteWebhook warn:', e.message);
  }

  await bot.telegram.setWebhook(WEBHOOK_URL, { drop_pending_updates: true });
  console.log(`✅ Webhook set: ${WEBHOOK_URL}`);
});

// Аккуратное завершение
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
