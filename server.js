// server.js
// Полностью самодостаточный сервер: Express + Telegraf + Webhook
const express = require('express');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/,''); // https://formapp-xvb0.onrender.com

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error('❌ Missing env vars. BOT_TOKEN and PUBLIC_URL are required.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ===== Команды =====
bot.start(async (ctx) => {
  await ctx.reply(
    'Welcome to FormApp 👋\nTap the button below to open the mini app.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: 'Web App', web_app: { url: PUBLIC_URL } }]]
      }
    }
  );
});

bot.command('ping', (ctx) => ctx.reply('pong'));
bot.on('text', async (ctx) => {
  // Игнорируем известные команды, чтобы не засорять чат
  const txt = ctx.message.text || '';
  if (/^\/(start|ping)\b/.test(txt)) return;
  await ctx.reply("Unrecognized command. Say what?");
});

// ===== Приём данных из WebApp =====
// ДАННЫЕ ПРИХОДЯТ СЮДА, когда в WebApp вызвали sendData() и пользователь закрыл окно.
bot.on('message', async (ctx) => {
  const msg = ctx.message;
  const wad = msg?.web_app_data?.data; // <-- ВАЖНО: здесь лежит payload из sendData

  if (wad) {
    let parsed = wad;
    try { parsed = JSON.parse(wad); } catch(e) {}
    console.log('📥 web_app_data:', parsed);

    const text = (typeof parsed === 'object' && parsed?.text) ? parsed.text : String(parsed);
    await ctx.reply(`Got it: ${typeof parsed==='string' ? parsed : JSON.stringify(parsed)}`);
    return;
  }
});

// ===== HTTP сервер и webhook =====
const app = express();

// простой healthcheck
app.get('/healthz', (_req, res) => res.send('ok'));

// отдаём статику из /public (index.html)
app.use(express.static('public'));

// Telegram Webhook endpoint
app.use(bot.webhookCallback('/tg'));

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  const webhookUrl = `${PUBLIC_URL}/tg`;
  try {
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ HTTP server on', PORT);
    console.log('✅ Webhook set to:', webhookUrl);
    console.log('✅ Primary URL:', PUBLIC_URL);
  } catch (e) {
    console.error('❌ setWebhook error:', e);
  }
});
