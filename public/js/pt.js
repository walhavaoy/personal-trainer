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
const logForm = document.getElementById('log-form');
const logStatus = document.getElementById('log-status');
const historyLoading = document.getElementById('history-loading');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');

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
  // Pre-fill the completed-minutes input with the planned total (user can edit before logging).
  logForm.elements['completedMinutes'].value = s.totalMinutes;
  logForm.dataset.date = s.date;
}

async function loadHistory() {
  const r = await fetch('/api/me/workouts');
  if (!r.ok) {
    historyLoading.textContent = 'Could not load history.';
    return;
  }
  const workouts = await r.json();
  historyList.innerHTML = '';
  if (workouts.length === 0) {
    historyLoading.hidden = true;
    historyEmpty.hidden = false;
    historyList.hidden = true;
    return;
  }
  for (const w of workouts) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.innerHTML = '<strong>' + w.date + '</strong> · ' + w.theme + ' · '
      + w.completedMinutes + '/' + w.plannedMinutes + ' min';
    li.appendChild(head);
    if (w.notes) {
      const notes = document.createElement('div');
      notes.className = 'muted';
      notes.textContent = w.notes;
      li.appendChild(notes);
    }
    historyList.appendChild(li);
  }
  historyLoading.hidden = true;
  historyEmpty.hidden = true;
  historyList.hidden = false;
}

logForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  logStatus.textContent = 'Saving…';
  const payload = {
    date: logForm.dataset.date,
    completedMinutes: parseInt(logForm.elements['completedMinutes'].value, 10) || 0,
    notes: logForm.elements['notes'].value || undefined,
  };
  const r = await fetch('/api/me/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'failed' }));
    logStatus.textContent = 'Error: ' + (err.error || 'failed');
    return;
  }
  logStatus.textContent = 'Logged.';
  logForm.elements['notes'].value = '';
  await loadHistory();
});

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
  await loadHistory();
})();
