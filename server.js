// server.js — Express + Telegraf (webhook), валидация initData, единая отправка в чат.

const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, ''); // без завершающих /
const PORT = process.env.PORT || 10000;

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error('ENV required: BOT_TOKEN and PUBLIC_URL');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(morgan('tiny'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- BOT ----------
const bot = new Telegraf(BOT_TOKEN);

// /start — привет + кнопка Web App
bot.start(async (ctx) => {
  await ctx.reply(
    'Welcome to FormApp 👋\nTap the button below to open the mini app.',
    Markup.inlineKeyboard([
      Markup.button.webApp('Web App', `${PUBLIC_URL}/`)
    ])
  );
});

// /ping
bot.command('ping', (ctx) => ctx.reply('pong'));

// Ловим данные, присланные через Telegram.WebApp.sendData (fallback для attach-варианта)
bot.on('message', async (ctx, next) => {
  const wad = ctx.message?.web_app_data?.data;
  if (wad) {
    let text = wad;
    try { text = JSON.parse(wad)?.text ?? wad; } catch {}
    await ctx.reply(`Got it: ${text}`);
    return;
  }
  return next();
});

// ---------- HELPERS ----------
// Валидация initData по докам Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
function validateInitData(initData, botToken) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calcHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calcHash === hash;
  } catch {
    return false;
  }
}

function extractChatOrUserIdFromInitData(initData) {
  // initData — это строка URLSearchParams
  const params = new URLSearchParams(initData);

  // В initData Telegram передаёт поля "user", "chat" как JSON-строки
  const chatRaw = params.get('chat');
  const userRaw = params.get('user');

  let chatId = null;
  let userId = null;
  try { chatId = chatRaw ? JSON.parse(chatRaw)?.id ?? null : null; } catch {}
  try { userId = userRaw ? JSON.parse(userRaw)?.id ?? null : null; } catch {}

  return chatId || userId || null;
}

// ---------- API из Mini App ----------
// Универсальный маршрут: мини-апп присылает text + initData; сервер валидирует и постит в чат
app.post('/api/send', async (req, res) => {
  const { text, initData } = req.body || {};
  if (!text || !initData) return res.status(400).json({ ok: false, error: 'Bad payload' });

  if (!validateInitData(initData, BOT_TOKEN)) {
    return res.status(403).json({ ok: false, error: 'Invalid initData' });
  }

  const chatId = extractChatOrUserIdFromInitData(initData);
  if (!chatId) return res.status(400).json({ ok: false, error: 'No chat/user id in initData' });

  try {
    await bot.telegram.sendMessage(chatId, `Got it: ${String(text)}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('/api/send error:', e);
    return res.status(500).json({ ok: false, error: 'internal' });
  }
});

// ---------- STATIC ----------
app.use(express.static(path.join(__dirname, 'public')));

// Health/diagnostics
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/tg', (_req, res) => res.status(200).send('Use POST to deliver Telegram updates'));

// ---------- WEBHOOK ----------
app.post('/tg', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
  } catch (e) {
    console.error('handleUpdate error:', e);
  }
  res.status(200).end();
});

app.listen(PORT, async () => {
  console.log('HTTP server on', PORT);
  try {
    const webhookUrl = `${PUBLIC_URL}/tg`;
    await bot.telegram.setWebhook(webhookUrl, {
      allowed_updates: ['message', 'callback_query', 'chat_member']
    });
    const info = await bot.telegram.getWebhookInfo();
    console.log('Webhook set to:', info.url);
    console.log('Primary URL   :', PUBLIC_URL);
  } catch (e) {
    console.error('setWebhook error:', e);
  }
});
