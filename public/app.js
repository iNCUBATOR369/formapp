// Инициализация Telegram WebApp API
const tg = window.Telegram.WebApp;

// Приводим UI к текущей цветовой схеме Telegram (light/dark)
function applyThemeFromTelegram() {
  const scheme = tg.colorScheme || "light";
  document.documentElement.dataset.theme = scheme;
}
applyThemeFromTelegram();

// Небольшой хелпер для изменения темы вручную
function toggleTheme() {
  const now =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = now;

  // Также красим «системные» цвета хедера/фона в Telegram
  if (now === "dark") {
    tg.setHeaderColor("#171a21");
    tg.setBackgroundColor("#0f1115");
  } else {
    tg.setHeaderColor("#ffffff");
    tg.setBackgroundColor("#f5f7fb");
  }
}

tg.onEvent("themeChanged", applyThemeFromTelegram);
tg.expand();
tg.ready();

// Элементы UI
const $msg = document.getElementById("msg");
const $send = document.getElementById("sendBtn");
const $theme = document.getElementById("themeBtn");
const $user = document.getElementById("userInfo");

// Пишем юзера (если Telegram дал)
if (tg.initDataUnsafe?.user) {
  const u = tg.initDataUnsafe.user;
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  $user.textContent =
    `User: ${name} ${u.username ? `(@${u.username})` : ""}`.trim();
}

// Отправка сообщения — ЕДИНЫМ способом через tg.sendData
// Это одинаково работает и из Menu Web App, и из "Web App"-кнопки в чате.
$send.addEventListener("click", () => {
  const text =
    ($msg.value || "This message came from the Mini App!").slice(0, 4096);

  tg.sendData(
    JSON.stringify({
      type: "form",
      text
    })
  );

  // Закрываем мини-апп сразу — сообщение придёт боту как web_app_data
  tg.close();
});

// Переключение темы
$theme.addEventListener("click", toggleTheme);
