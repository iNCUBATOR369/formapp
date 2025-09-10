(() => {
  const tg = window.Telegram?.WebApp;
  tg?.expand();
  tg?.ready();

  const input = document.querySelector('#msg');
  const sendBtn = document.querySelector('#sendBtn');
  const themeBtn = document.querySelector('#themeBtn');
  const userDiv = document.querySelector('#user');

  if (tg?.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    userDiv.textContent = `User: ${u.username ? '@'+u.username : u.first_name}`;
  }

  const applyTheme = () => {
    const isDark = tg?.colorScheme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  };
  applyTheme();
  tg?.onEvent('themeChanged', applyTheme);

  sendBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    const chatId = tg?.initDataUnsafe?.user?.id;

    if (!chatId) {
      tg.showAlert('chat_id not found. Open bot in private chat.');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    try {
      const res = await fetch('/tg/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });
      const data = await res.json().catch(()=> ({}));

      if (res.ok && data.ok) {
        tg.showPopup({
          title: 'Telegram',
          message: 'Sent!',
          buttons: [{ type: 'close' }]
        });
        setTimeout(() => tg.close(), 250);
      } else {
        tg.showAlert(data.description || 'Error sending');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to bot';
      }
    } catch (e) {
      tg.showAlert('Network error: ' + e.message);
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send to bot';
    }
  });

  themeBtn.addEventListener('click', () => {
    tg.showAlert(`Theme: ${document.documentElement.dataset.theme}`);
  });
})();
