(async () => {
  const whoEl = document.getElementById('who');
  const firstNameEl = document.getElementById('firstName');
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (!r.ok) {
      whoEl.textContent = 'not signed in';
      return;
    }
    const me = await r.json();
    const display = me.fullName || me.username;
    whoEl.textContent = display + (me.email ? ' (' + me.email + ')' : '');
    if (display) {
      firstNameEl.textContent = display.split(/\s+/)[0];
    }
  } catch (err) {
    whoEl.textContent = 'error loading identity';
  }
})();
