// server.js — финальная версия (MVP)
// Режим: webhook на Render. Получаем web_app_data из мини-приложения и отвечаем в чат.

require('dotenv').config();
const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, ''); // без трейлинг-слэша
const PORT = process.env.PORT || 10000;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is missing in environment variables');
  process.exit(1);
}
if (!PUBLIC_URL || !/^https:\/\//.test(PUBLIC_URL)) {
  console.error('❌ PUBLIC_URL must be set and start with https:// (your Render URL)');
  process.exit(1);
}

const app = express();
const bot = new Telegraf(BOT_TOKEN);

// --- 1) Статика мини-приложения ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 2) Healthcheck (Render) ---
app.get('/healthz', (_, res) => res.status(200).send('OK'));

// --- 3) Webhook endpoint ---
const hookPath = `/tg/${BOT_TOKEN}`;
app.use(bot.webhookCallback(hookPath));

// --- 4) Базовые хэндлеры бота ---

// /start — отправляем клавиатуру с web_app-кнопкой, открывающей PUBLIC_URL
bot.start(async (ctx) => {
  try {
    await ctx.reply(
      'Welcome to FormApp 👋\nTap the button below to open the mini app.',
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: 'Open FormApp',
                web_app: { url: PUBLIC_URL }, // откроет наше мини-приложение
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      }
    );
  } catch (e) {
    console.error('Error in /start:', e);
  }
});

// /ping — простая проверка ответа бота
bot.command('ping', (ctx) => ctx.reply('pong'));

// Получение данных из мини-приложения (sendData)
// Telegram присылает сообщение с полем web_app_data
bot.on('message', async (ctx) => {
  try {
    const msg = ctx.message;
    if (msg && msg.web_app_data && msg.web_app_data.data) {
      // Строка, которую отправили из WebApp
      const raw = msg.web_app_data.data;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (_) {}

      await ctx.reply(`Got it: ${parsed ? JSON.stringify(parsed) : raw}`);
    }
  } catch (e) {
    console.error('Error handling message:', e);
  }
});

// --- 5) Запуск сервера и установка webhook ---
app.listen(PORT, async () => {
  try {
    const fullHook = `${PUBLIC_URL}${hookPath}`;
    await bot.telegram.setWebhook(fullHook);
    console.log(`✅ HTTP server on ${PORT}`);
    console.log(`✅ Webhook set to: ${fullHook}`);
    console.log(`✅ Primary URL: ${PUBLIC_URL}`);
  } catch (e) {
    console.error('Failed to set webhook:', e);
  }
});
