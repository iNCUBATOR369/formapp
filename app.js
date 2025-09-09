// Мини-апп: единая отправка через /api/send (валидирует initData на сервере).
// Fallback: если хотим проверить attach-вариант — закомментируй fetch и вызови tg.sendData.

(function () {
  const tg = window.Telegram.WebApp;
  tg.ready();           // сообщаем Telegram, что UI готов
  tg.expand();          // попросим побольше высоты

  const $ = (s) => document.querySelector(s);
  const msg    = $('#msg');
  const send   = $('#send');
  const toggle = $('#toggle');
  const who    = $('#who');

  // ----- ТЕМА -----
  function applyThemeFromTelegram() {
    document.documentElement.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
  }
  applyThemeFromTelegram();
  tg.onEvent('themeChanged', applyThemeFromTelegram);

  toggle.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    // косметика заголовка в Telegram-контейнере
    try { tg.setHeaderColor(next === 'dark' ? '#0f1115' : '#ffffff'); } catch {}
  });

  // Немного информации о пользователе
  const u = tg.initDataUnsafe?.user;
  if (u) who.textContent = u.username ? `@${u.username}` : `${u.first_name || ''} (id:${u.id})`;

  // ----- ОТПРАВКА -----
  send.addEventListener('click', async () => {
    const text = (msg.value || '').trim() || 'This message came from the Mini App!';
    send.disabled = true;

    // Основной путь: /api/send (универсально и надёжно)
    try {
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text, initData: tg.initData })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      // успех → покажем лёгкий алерт и закроем окно
      try { await tg.showAlert('Sent!'); } catch {}
      try { tg.close(); } catch {}
    } catch (e) {
      // если что-то пошло не так — аккуратно покажем причину
      try { await tg.showAlert('Error: ' + (e?.message || e)); } catch {}
      send.disabled = false;
    }
  });
})();
