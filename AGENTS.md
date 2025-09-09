# ТЗ для Codex: FormApp — Telegram Mini App-конструктор

## 0) Роль Codex и ожидаемый формат отдачи

* Codex действует как **ведущий разработчик**.
* Каждая задача: предоставляет **готовые файлы целиком** (не фрагменты), инструкции по деплою и короткие чек-листы для ручной проверки.
* Код — сразу рабочий, без “TODO”.
* Стек и структура — как описано ниже. Если предлагается улучшение, сначала дать дифф-вариант «Текущее → Предложение» и объяснить миграцию.

---

## 1) Короткое описание продукта

**FormApp** — Telegram Mini App (TWA) + бот, который:

1. открывается из чата кнопкой **Web App** (меню бота) и/или кнопкой **Open FormApp** (внутренняя кнопка в сообщении),
2. показывает простую форму (текст → кнопка “Send to bot”),
3. отправляет введённый текст в чат, из которого приложение было открыто,
4. уважает тему (light/dark) Telegram,
5. корректно закрывает окно по завершении (без «вторых» не закрывающихся попапов).

**Дальше (следующие релизы)**: превратить мини-апп в **конструктор форм**: создавать формы (поля, правила), публиковать их и собирать ответы, хранить их в БД, отправлять ответы в чат и в админку.

---

## 2) Текущее рабочее состояние (зафиксировать)

* Деплой на **Render** как Web Service (Node).
* Сервер — Node.js + Express + Telegraf.
* Веб-хука бота: `POST /tg`.
* Статика мини-апа — из `/public`.
* Переменные окружения:
  * `BOT_TOKEN` — токен Telegram-бота,
  * `PUBLIC_URL` — корень хоста Render без трейлинг-слеша, напр. `https://formapp-xvb0.onrender.com`.
* Команды бота: `/start` (приветствие + кнопка открытия Web App), `/ping` → `pong`.
* **Работает**:
  * открытие по обеим кнопкам,
  * отправка сообщения из мини-апа,
  * корректное закрытие окна (без «залипающих» модалок),
  * логирование на Render.
* **Важно**: код должен быть **единым** и не ломать уже рабочие механики.

---

## 3) Цель ближайшего релиза (MVP-стабилизация)

### 3.1. Требования к серверу

* Стек: **Node 18+**, **Express**, **Telegraf 4**, **CommonJS** (чтобы не было warning’ов про ESM в Render).
* Структура репозитория:

```
/package.json
/server.js
/.render-build.sh            (опционально, если понадобится скрипт)
/public
  /index.html
  /app.js
  /styles.css
```

* **package.json** (пример):

```json
{
  "name": "formapp",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "telegraf": "^4.16.3",
    "body-parser": "^1.20.2",
    "morgan": "^1.10.0",
    "helmet": "^7.1.0"
  }
}
```

* **server.js** — единый файл, который:
  1. Поднимает Express, раздаёт `/public` как статику.
  2. Подключает Telegraf, ставит веб-хук на `POST /tg` → `bot.webhookCallback('/tg')`.
  3. Реализует `GET /healthz` (возвращает `{ok:true}`).
  4. Обрабатывает команды `/start` и `/ping`.
  5. Имеет REST-эндпойнт `POST /api/send`:
     * принимает `{ text, initData }`,
     * **верифицирует `initData`** по HMAC (см. “Security” ниже),
     * определяет `chat_id` (из `initData` → `chat.id` либо, если нет, `user.id`),
     * отправляет `text` в чат через `bot.telegram.sendMessage(chat_id, ...)`,
     * возвращает `{ ok: true }` или `{ ok:false, error:... }`.
  6. Логирование (morgan) и защита заголовков (helmet).

* **Старт-команда Render**: `node server.js`.
* **Build-команда**: `npm install`.
* **Веб-хук** на старте — устанавливать программно: `await bot.telegram.setWebhook(PUBLIC_URL + '/tg')`.

> **Замечание:** Никаких внешних axios/fetch на сервере — только `bot.telegram.sendMessage` и Express.

### 3.2. Требования к фронтенду (`/public`)

* **index.html**:
  * подключает `<script src="https://telegram.org/js/telegram-web-app.js"></script>`,
  * минимальная вёрстка: поле ввода, `Send to bot`, переключатель темы (меняет CSS-переменные),
  * всплывающие тосты/алерты — нативные Telegram `showAlert` / `showPopup` (без “второго” модального окна).
* **app.js**:
  * `Telegram.WebApp.ready(); Telegram.WebApp.expand();`
  * читаем `initDataUnsafe` и прокидываем его строкой `initData` при POST `/api/send`,
  * после успешной отправки:
    * показать `showAlert('Sent!')`,
    * **и затем** вызвать `Telegram.WebApp.close();` (без дополнительных оверлеев),
    * при ошибке — `showAlert('Error: ...')`, **не закрывать**.
* **styles.css**:
  * две темы через `:root` и `[data-theme="dark"]` (основано на `Telegram.WebApp.colorScheme`),
  * без сторонних UI-фреймворков.

### 3.3. Безопасность

* **Проверка initData на сервере** (обязательно):
  * Реализовать в `server.js` функцию валидации по [докам Telegram](https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app).
  * HMAC-SHA256 с ключом `hash = HMAC_SHA256(data_check_string, secret_key)`, где `secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)`.
  * При невалидном `initData` → 403.

### 3.4. UX-ограничения (важно)

* **Единый сценарий закрытия**: после `ok` ответа сервера — показать один небольшой alert/тост и **закрыть окно**. Никаких вторичных оверлеев “Close”, которые нельзя закрыть.
* Работает одинаково при открытии:
  * через **кнопку Web App** из меню бота,
  * через **кнопку Open FormApp** (inline-кнопка в сообщении).

### 3.5. Конфигурация BotFather

* Команды:
  * `/start` — Open app,
  * `/ping` — pong,
  * `/help` — краткая подсказка.
* **Menu Button (Web App URL)** = `${PUBLIC_URL}` (без трейлинг-слеша).
* **Domain** — домен Render (указан выше).

### 3.6. Приёмка (чек-лист)

1. `/healthz` → 200, `{ok:true}`.
2. `GET https://api.telegram.org/bot<token>/getWebhookInfo` → `{"url": "<PUBLIC_URL>/tg", "pending_update_count": ...}`.
3. `/start` → приветствие + кнопка **Web App**.
4. `/ping` → `pong`.
5. Открыть Web App (меню) → ввести “Hello from menu” → сообщение появляется в том же чате; окно закрывается.
6. Нажать inline-кнопку **Open FormApp** из приветствия → ввести “Hello from inline” → сообщение приходит; окно закрывается; тема совпадает с Telegram; лишних окон нет.
7. Логи Render без ошибок (нет ESM warning, axios not found и т.п.).

---

## 4) Следующий этап: превратить в конструктор форм

### 4.1. Архитектура

* Добавить **PostgreSQL** (Render Postgres).
* ORM: **Prisma**.
* Сущности:
  * `User(id, tg_id, username, created_at)`,
  * `Form(id, owner_id, title, schema_json, is_published, created_at, updated_at)`,
  * `Submission(id, form_id, tg_user_id, chat_id, payload_json, created_at)`.
* `schema_json` — JSON-описание полей (text, select, checkbox, file\*).
* TWA загружает форму `GET /api/forms/:id` → отрисовывает поля динамически.
* `POST /api/forms/:id/submit` — сохраняет Submission + отправляет краткое резюме в чат.

### 4.2. Админ-панель (микро-MVP)

* `/admin` (базовая аутентификация по токену в .env, позже — Telegram OAuth).
* CRUD форм:
  * создать форму (title + schema_json),
  * включить/выключить публикацию,
  * список сабмишнов с фильтрами/экспортом `.csv`.

### 4.3. Безопасность и верификация пользователя

* В TWA валидация initData (как выше).
* Для приватных методов (создание форм) — отдельный **ADMIN_TOKEN** в .env; потом заменить на Telegram OAuth + role-based access.

### 4.4. Трассировка/метрики

* Стандартные логи + метка запроса (request-id).
* Health-checks, алерты Render (если есть).

---

## 5) Файловый скелет (референс, чтобы Codex знал целевую форму)

### 5.1. `server.js` (контуры)

```js
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const { Telegraf } = require('telegraf');
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;

if (!BOT_TOKEN || !PUBLIC_URL) {
  console.error('BOT_TOKEN or PUBLIC_URL is missing');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------- Telegram bot
bot.start(async (ctx) => {
  // Кнопка для inline-открытия
  await ctx.reply('Welcome to FormApp 👋\nTap the button below to open the mini app.', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open FormApp', web_app: { url: PUBLIC_URL } }]],
    },
  });
});
bot.command('ping', (ctx) => ctx.reply('pong'));

// Вебхук
app.use('/tg', bot.webhookCallback('/tg'));

// -------- REST API
app.get('/healthz', (_, res) => res.json({ ok: true }));

// Валидация initData из Telegram WebApp
function validateInitData(initData) {
  // https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calcHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

    return calcHash === hash;
  } catch {
    return false;
  }
}

app.post('/api/send', async (req, res) => {
  const { text, initData } = req.body || {};
  if (!text || !initData) return res.status(400).json({ ok: false, error: 'Bad payload' });
  if (!validateInitData(initData)) return res.status(403).json({ ok: false, error: 'Invalid initData' });

  const unsafe = Object.fromEntries(new URLSearchParams(initData));
  const chat = unsafe.chat ? JSON.parse(unsafe.chat) : null;
  const user = unsafe.user ? JSON.parse(unsafe.user) : null;

  const chatId = (chat && chat.id) || (user && user.id);
  if (!chatId) return res.status(400).json({ ok: false, error: 'No chat_id' });

  try {
    await bot.telegram.sendMessage(chatId, `Got it: ${text}`);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Send failed' });
  }
});

// -------- Static
app.use(express.static(path.join(__dirname, 'public')));

// -------- Start
async function start() {
  await bot.telegram.setWebhook(`${PUBLIC_URL}/tg`);
  const port = process.env.PORT || 10000;
  app.listen(port, () => console.log('HTTP server on', port));
}
start().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### 5.2. `/public/index.html` (контуры)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FormApp</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="card">
    <h1>Welcome to FormApp 👋</h1>
    <input id="msg" placeholder="This message came from the Mini App!" />
    <div class="row">
      <button id="send">Send to bot</button>
      <button id="toggle">Toggle theme</button>
    </div>
    <p id="user"></p>
  </main>

  <script src="/app.js"></script>
</body>
</html>
```

### 5.3. `/public/app.js` (контуры)

```js
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const msg = document.getElementById('msg');
const btn = document.getElementById('send');
const toggle = document.getElementById('toggle');
const userEl = document.getElementById('user');

const u = tg.initDataUnsafe?.user;
userEl.textContent = u ? `User: ${u.username ?? u.id}` : '';

function applyTheme() {
  document.documentElement.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
}
applyTheme();

toggle.onclick = () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
};

btn.onclick = async () => {
  const text = msg.value.trim() || 'This message came from the Mini App!';
  try {
    const r = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, initData: tg.initData })
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'unknown');
    await tg.showAlert('Sent!');
    tg.close(); // единый сценарий закрытия
  } catch (e) {
    await tg.showAlert('Error: ' + e.message);
  }
};
```

### 5.4. `/public/styles.css` (контуры)

```css
:root {
  --bg: #ffffff;
  --fg: #111111;
  --primary: #0a84ff;
  --card: #f5f7fb;
  --radius: 14px;
}
:root[data-theme="dark"] {
  --bg: #0e0f13;
  --fg: #ffffff;
  --primary: #56b2ff;
  --card: #171a21;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }

main.card {
  max-width: 560px;
  margin: 40px auto;
  background: var(--card);
  padding: 24px;
  border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}

input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12); background: #fff; }
.row { display: flex; gap: 12px; margin-top: 12px; }
button { flex: 1; padding: 12px; border-radius: 12px; border: none; background: var(--primary); color: #fff; font-weight: 600; cursor: pointer; }
```

---

## 6) План релизов / приоритеты

1. **Стабилизация MVP (спринт 1)**
   * Восстановить рабочий код по скелету выше.
   * Проверка initData на сервере.
   * Унификация UX закрытия окна.
   * Чистые логи на Render, `/start` и `/ping` работают стабильно.
   * Чек-лист приёмки пройден.
2. **Конструктор форм (спринт 2–3)**
   * Подключить Postgres (Render), Prisma.
   * CRUD форм + публикация.
   * Рендер формы по `schema_json` в TWA.
   * `POST /submit` → сохранение + сообщение в чат.
   * Простая админ-панель `/admin` (по токену).
3. **Улучшения (спринт 4+)**
   * Telegram OAuth для админки.
   * Поля: файлы/медиа, геолокация, подпись, калькуляторы.
   * Веб-хуки интеграций (CRM/Sheets).
   * Мульти-язык, A/B, аналитика.

---

## 7) Деплой (Render) — краткая памятка

* **Start Command**: `node server.js`
* **Build Command**: `npm install`
* **Env**:
  * `BOT_TOKEN=...`
  * `PUBLIC_URL=https://formapp-xvb0.onrender.com` *(без последнего `/`)*
* После первого старта проверить:
  * `/healthz`,
  * `getWebhookInfo` → `.../tg`.

---

## 8) Что сделать Codex прямо сейчас

1. Сгенерировать **полный репозиторий** по скелету выше (все файлы целиком).
2. Убедиться, что **нет** ESM-warning на Render, `/start` и `/ping` работают.
3. Реализовать валидацию initData.
4. Добиться одинаковой работы отправки и закрытия окна из **обеих** точек входа (Web App menu + Open FormApp).
5. Выдать пошаговую инструкцию ручной проверки (чек-лист из 3.6).

