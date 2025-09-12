const tg = window.Telegram?.WebApp;

// ——— Инициализация UI/темы ———
function applyTelegramTheme() {
  if (!tg) return;

  document.body.style.setProperty("--bg", tg.themeParams?.bg_color ?? "");
  document.body.style.setProperty("--fg", tg.themeParams?.text_color ?? "");
  document.body.style.setProperty(
    "--card",
    tg.themeParams?.secondary_bg_color ?? ""
  );
  document.body.style.setProperty(
    "--muted",
    tg.themeParams?.hint_color ?? ""
  );

  document.documentElement.setAttribute(
    "data-theme",
    tg.colorScheme === "dark" ? "dark" : "light"
  );
}

function toggleTheme() {
  const curr = document.documentElement.getAttribute("data-theme");
  const next = curr === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
}

function showPopup(title, message) {
  if (tg && tg.showPopup) {
    tg.showPopup({ title, message, buttons: [{ type: "close" }] });
  } else {
    alert(`${title}\n\n${message}`);
  }
}

// ——— Старт ———
const input = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const themeBtn = document.getElementById("themeBtn");
const closeSwitch = document.getElementById("closeSwitch");
const userInfo = document.getElementById("userInfo");

if (tg) {
  tg.expand();
  applyTelegramTheme();
  tg.onEvent("themeChanged", applyTelegramTheme);

  const user = tg.initDataUnsafe?.user;
  if (user) {
    userInfo.textContent = `User: @${user.username ?? user.id}`;
  }
} else {
  userInfo.textContent = "Running outside Telegram";
}

themeBtn.addEventListener("click", () => toggleTheme());

sendBtn.addEventListener("click", () => {
  const text = input.value.trim() || "This message came from the Mini App!";
  const payload = {
    type: "form",
    text,
    ts: Date.now()
  };

  if (!tg || !tg.sendData) {
    showPopup("Error", "Telegram WebApp API not available.");
    return;
  }

  // Отправляем в бота. Бот ответит в чат, ловя web_app_data
  tg.sendData(JSON.stringify(payload));

  showPopup("Telegram", "Sent!");
  if (closeSwitch.checked) {
    // Закрывать по желанию пользователя
    tg.close();
  }
});
