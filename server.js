// server.js
// Полностью готовый сервер: обслуживает мини-апп и принимает события из него.
// Работают ОДНОВРЕМЕННО два сценария:
// 1) открытие по inline-кнопке (web_app_query) → answerWebAppQuery()
// 2) открытие по кнопке Web App в меню бота → обычное sendMessage(chat_id)

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Telegraf } = require('telegraf');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL; // например: https://formapp-xvb0.onrender.com

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set!');
  process.exit(1);
}
if (!PUBLIC_URL) {
  console.error('PUBLIC_URL is not set!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(bodyParser.json());

// ===== serve mini app (статические файлы)
app.use(express.static(path.join(__dirname, 'public')));

// ===== healthcheck (Render)
app.get('/healthz', (_, res) => res.send('OK'));

// ===== простой пинг-команд для проверки
bot.command('start', (ctx) =>
  ctx.reply('Welcome to FormApp 👋\nTap the button below to open the mini app.',
    { reply_markup: { inline_keyboard: [[{ text: 'Web App', web_app: { url: PUBLIC_URL } }]] } }
  )
);
bot.command('ping', (ctx) => ctx.reply('pong'));

// ===== webhook для mini-app (унифицированный)
app.post('/tg', async (req, res) => {
  try {
    const { text, userId, chatId, queryId } = req.body || {};

    if (!text) {
      return res.status(400).json({ ok: false, error: 'No text' });
    }

    // 1) inline-кнопка → есть queryId → шлём answerWebAppQuery
    if (queryId) {
      await bot.telegram.answerWebAppQuery(queryId, {
        type: 'article',
        id: String(Date.now()),
        title: 'Message received',
        input_message_content: {
          message_text: `Got it: ${text}`
        }
      });
      return res.json({ ok: true, mode: 'answerWebAppQuery' });
    }

    // 2) кнопка в меню → нет queryId → шлём обычное сообщение пользователю/в чат
    const recipient = chatId || userId;
    if (!recipient) {
      return res.status(400).json({
        ok: false,
        error: 'No recipient (userId/chatId). Open the mini app from the bot chat.'
      });
    }

    await bot.telegram.sendMessage(
      recipient,
      `Got it: ${text}`
    );
    return res.json({ ok: true, mode: 'sendMessage', to: recipient });
  } catch (err) {
    console.error('POST /tg error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ===== webhook обработка Telegram (если нужен polling)
bot.on('message', (ctx) => {
  // Логируем входящие апдейты для диагностики
  try {
    const msg = ctx.update.message;
    console.log('Incoming update:', JSON.stringify(msg));
  } catch {}
});

// ===== старт сервера + polling (Render сам дёргает внешним https)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`HTTP server on ${PORT}`);
  // polling включаем — он совместим с Render free и не требует setWebhook
  bot.launch().then(() => {
    console.log('Bot launched with long polling');
    console.log('Primary URL:', PUBLIC_URL);
    console.log('Mini app path:', PUBLIC_URL + '/');
  });
});

// Грейсфул шатдаун
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
