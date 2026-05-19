const whoEl = document.getElementById('who');
const firstNameEl = document.getElementById('firstName');
const sessionLoading = document.getElementById('session-loading');
const sessionEl = document.getElementById('session');
const sessionDay = document.getElementById('session-day');
const sessionTheme = document.getElementById('session-theme');
const sessionTotal = document.getElementById('session-total');
const sessionBlocks = document.getElementById('session-blocks');
const form = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');

async function loadMe() {
  const r = await fetch('/api/me');
  if (!r.ok) {
    whoEl.textContent = 'not signed in';
    return null;
  }
  const me = await r.json();
  const display = me.fullName || me.username;
  whoEl.textContent = display + (me.email ? ' (' + me.email + ')' : '');
  firstNameEl.textContent = display ? display.split(/\s+/)[0] : 'athlete';
  return me;
}

async function loadProfile() {
  const r = await fetch('/api/me/profile');
  if (!r.ok) return null;
  const p = await r.json();
  form.elements['goal'].value = p.goal;
  form.elements['fitnessLevel'].value = p.fitnessLevel;
  form.elements['weeklyMinutes'].value = p.weeklyMinutes;
  return p;
}

async function loadToday() {
  const r = await fetch('/api/me/today');
  if (!r.ok) {
    sessionLoading.textContent = 'Could not load today’s session.';
    return;
  }
  const s = await r.json();
  sessionDay.textContent = s.dayOfWeek;
  sessionTheme.textContent = s.theme;
  sessionTotal.textContent = s.totalMinutes;
  sessionBlocks.innerHTML = '';
  for (const b of s.blocks) {
    const li = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = b.name + (b.durationMinutes ? ' · ' + b.durationMinutes + ' min' : '');
    const notes = document.createElement('div');
    notes.className = 'muted';
    notes.textContent = b.notes;
    li.appendChild(title);
    li.appendChild(notes);
    sessionBlocks.appendChild(li);
  }
  sessionLoading.hidden = true;
  sessionEl.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileStatus.textContent = 'Saving…';
  const payload = {
    goal: form.elements['goal'].value,
    fitnessLevel: form.elements['fitnessLevel'].value,
    weeklyMinutes: parseInt(form.elements['weeklyMinutes'].value, 10) || 0,
  };
  const r = await fetch('/api/me/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'failed' }));
    profileStatus.textContent = 'Error: ' + (err.error || 'failed');
    return;
  }
  profileStatus.textContent = 'Saved.';
  await loadToday();
});

(async () => {
  const me = await loadMe();
  if (!me) return;
  await loadProfile();
  await loadToday();
})();
