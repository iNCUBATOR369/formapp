// public/app.js
(() => {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    alert('Telegram WebApp SDK not found');
    return;
  }

  tg.expand(); // безопасно
  tg.ready();

  const input = document.querySelector('#msg');
  const sendBtn = document.querySelector('#sendBtn');
  const themeBtn = document.querySelector('#themeBtn');

  // Примитивный индикатор/блокировка
  const setBusy = (v) => {
    sendBtn.disabled = v;
    sendBtn.textContent = v ? 'Sending…' : 'Send to bot';
  };

  // Тема (оставляю как было)
  const applyTheme = () => {
    const isDark = tg.colorScheme === 'dark' || tg.themeParams?.bg_color === '#000000';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  };
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);

  themeBtn?.addEventListener('click', () => {
    // чисто для демо — дергаем alert, тему в Telegram меняют пользователи в настройках
    tg.showAlert(`Theme: ${document.documentElement.dataset.theme}`);
  });

  // === КЛЮЧЕВОЙ ФИКС: ждём fetch -> ждём ответ Telegram -> только потом закрываем ===
  sendBtn.addEventListener('click', async () => {
    const text = (input.value || '').trim() || 'This message came from the Mini App!';
    const chatId = tg.initDataUnsafe?.user?.id; // приватный чат = user.id

    if (!chatId) {
      tg.showAlert('No chat_id in initData. Open this Mini App from a private chat with the bot.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/tg/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        // Покажем реальную причину, чтобы было понятно
        const reason = data?.description || `${res.status} ${res.statusText}`;
        tg.showAlert(`Error: ${reason}`);
        setBusy(false);
        return;
      }

      // Успех: теперь можно закрывать
      tg.showPopup({
        title: 'Telegram',
        message: 'Sent!',
        buttons: [{ type: 'close' }]
      });

      // Маленькая задержка, чтобы пользователь успел увидеть "Sent!"
      setTimeout(() => tg.close(), 250);
    } catch (err) {
      tg.showAlert(`Network error: ${err?.message || err}`);
      setBusy(false);
    }
  });
})();
