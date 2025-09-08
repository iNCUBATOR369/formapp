// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL; // например: https://formapp-xvb0.onrender.com
if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error('❌ BOT_TOKEN или PUBLIC_URL не заданы в переменных окружения');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Инициализация бота
const bot = new Telegraf(BOT_TOKEN);

// 1) Пришли данные из мини-приложения: WebApp.sendData(...)
bot.on('message', async (ctx) => {
  try {
    const msg = ctx.message || {};
    // если пришло web_app_data
    if (msg.web_app_data && typeof msg.web_app_data.data === 'string') {
      const data = msg.web_app_data.data;
      await ctx.reply(`📦 Received from Mini App: ${data}`);
      return;
    }

    // обычный текст — эхо
    if (msg.text) {
      await ctx.reply(`You said: ${msg.text}`);
    }
  } catch (err) {
    console.error('❌ Error in message handler:', err);
  }
});

// 2) Вебхук
const webhookPath = `/tg/${BOT_TOKEN}`;
app.use(webhookPath, (req, res, next) => {
  // для отладки — чтобы видеть каждый входящий апдейт в логах Render
  console.log('➡️  Incoming update:', JSON.stringify(req.body));
  next();
}, bot.webhookCallback(webhookPath));

// 3) Главная (для быстрого “жив ли сервер”)
app.get('/healthz', (_, res) => res.status(200).send('OK'));

// 4) Стартуем
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`🚀 HTTP server on ${PORT}`);

  // Ставим вебхук
  const webhookUrl = `${PUBLIC_URL}${webhookPath}`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    const info = await bot.telegram.getWebhookInfo();
    console.log('✅ Webhook set to:', info.url || webhookUrl);
  } catch (err) {
    console.error('❌ setWebhook error:', err);
  }
});
