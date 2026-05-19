const whoEl = document.getElementById('who');
const firstNameEl = document.getElementById('firstName');
const sessionLoading = document.getElementById('session-loading');
const sessionEl = document.getElementById('session');
const sessionDay = document.getElementById('session-day');
const sessionTheme = document.getElementById('session-theme');
const sessionTotal = document.getElementById('session-total');
const sessionBlocks = document.getElementById('session-blocks');
const trainerNote = document.getElementById('trainer-note');
const form = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');
const logForm = document.getElementById('log-form');
const logStatus = document.getElementById('log-status');
const logDone = document.getElementById('log-done');
const restButton = document.getElementById('rest-button');
const historyLoading = document.getElementById('history-loading');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const summaryEl = document.getElementById('summary');
const summaryMinutes = document.getElementById('summary-minutes');
const summaryTarget = document.getElementById('summary-target');
const summarySessions = document.getElementById('summary-sessions');
const summaryBar = document.getElementById('summary-bar');
const summaryStreak = document.getElementById('summary-streak');
const summaryLast = document.getElementById('summary-last');
const summaryTrend = document.getElementById('summary-trend');
const summaryLastWeek = document.getElementById('summary-last-week');
const summaryCoach = document.getElementById('summary-coach');
const previewList = document.getElementById('preview-list');

const TREND_GLYPH = { up: '↑', down: '↓', flat: '→', new: '·' };

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
  form.elements['timezone'].value = p.timezone || 'UTC';

  // On first load only, if the profile is still on UTC and the browser knows a
  // real zone, push it once so the user doesn't have to figure out the field.
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browserTz && browserTz !== 'UTC' && (p.timezone === 'UTC' || !p.timezone)) {
    const r2 = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: browserTz }),
    });
    if (r2.ok) {
      const p2 = await r2.json();
      form.elements['timezone'].value = p2.timezone;
      return p2;
    }
  }
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
  trainerNote.textContent = s.trainerNote || '';
  trainerNote.className = 'trainer-note trainer-note--' + (s.adaptation || 'baseline');
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
    if (Array.isArray(b.exercises) && b.exercises.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'exercise-list';
      ul.dataset.testid = 'pt-list-exercises';
      for (const ex of b.exercises) {
        const ei = document.createElement('li');
        ei.textContent = ex.prescription;
        ul.appendChild(ei);
      }
      li.appendChild(ul);
    }
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
  reflectTodayLogged(workouts);
  if (workouts.length === 0) {
    historyLoading.hidden = true;
    historyEmpty.hidden = false;
    historyList.hidden = true;
    return;
  }
  for (const w of workouts) {
    historyList.appendChild(renderHistoryItem(w));
  }
  historyLoading.hidden = true;
  historyEmpty.hidden = true;
  historyList.hidden = false;
}

function reflectTodayLogged(workouts) {
  // Date the user is *currently looking at* — pulled from the loaded session.
  const today = logForm.dataset.date;
  if (!today) return;
  const t = workouts.find((w) => w.date === today);
  if (t) {
    logForm.hidden = true;
    logDone.hidden = false;
    const label = t.theme === 'Rest'
      ? `Rest day taken — nothing logged today.`
      : `Logged today: ${t.completedMinutes}/${t.plannedMinutes} min · ${t.theme}`;
    logDone.textContent = label;
  } else {
    logForm.hidden = false;
    logDone.hidden = true;
  }
}

function renderHistoryItem(w) {
  const li = document.createElement('li');
  li.dataset.id = w.id;
  li.dataset.testid = 'pt-row-workout';

  const head = document.createElement('div');
  head.className = 'history-head';
  const summary = document.createElement('span');
  summary.innerHTML = '<strong>' + w.date + '</strong> · ' + w.theme + ' · '
    + '<span class="completed-min">' + w.completedMinutes + '</span>/' + w.plannedMinutes + ' min';
  const actions = document.createElement('span');
  actions.className = 'history-actions';
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'link-btn';
  editBtn.dataset.testid = 'pt-button-edit';
  editBtn.textContent = 'Edit';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'link-btn link-btn--danger';
  delBtn.dataset.testid = 'pt-button-delete';
  delBtn.textContent = 'Delete';
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  head.appendChild(summary);
  head.appendChild(actions);
  li.appendChild(head);

  if (w.notes) {
    const notes = document.createElement('div');
    notes.className = 'muted history-notes';
    notes.textContent = w.notes;
    li.appendChild(notes);
  }

  editBtn.addEventListener('click', () => beginEditHistoryItem(li, w));
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete workout from ${w.date}?`)) return;
    const r = await fetch('/api/me/workouts/' + w.id, { method: 'DELETE' });
    if (!r.ok) { alert('Delete failed'); return; }
    await loadHistory();
    await loadSummary();
  });

  return li;
}

function beginEditHistoryItem(li, w) {
  // Replace the head with an inline edit form
  li.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'history-edit';
  form.dataset.testid = 'pt-form-edit';
  form.innerHTML =
    '<strong>' + w.date + '</strong> · ' + w.theme + ' · ' +
    '<input type="number" name="completedMinutes" min="0" max="1000" required style="width:5em" />' +
    ' / ' + w.plannedMinutes + ' min' +
    ' <input type="text" name="notes" maxlength="500" placeholder="notes" style="width:14em" />' +
    ' <button type="submit" class="link-btn">Save</button>' +
    ' <button type="button" class="link-btn link-btn--danger" data-cancel>Cancel</button>';
  form.elements['completedMinutes'].value = w.completedMinutes;
  form.elements['notes'].value = w.notes || '';
  li.appendChild(form);

  form.querySelector('[data-cancel]').addEventListener('click', () => { loadHistory(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      completedMinutes: parseInt(form.elements['completedMinutes'].value, 10),
      notes: form.elements['notes'].value || null,
    };
    const r = await fetch('/api/me/workouts/' + w.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'failed' }));
      alert('Save failed: ' + (err.error || 'unknown'));
      return;
    }
    await loadHistory();
    await loadSummary();
  });
}

async function loadPreview() {
  const r = await fetch('/api/me/preview?days=3');
  if (!r.ok) return;
  const items = await r.json();
  previewList.innerHTML = '';
  for (const p of items) {
    const li = document.createElement('li');
    const day = document.createElement('strong');
    day.textContent = p.dayOfWeek;
    const date = document.createElement('span');
    date.className = 'muted preview-date';
    date.textContent = p.date;
    const sep = document.createTextNode(' · ');
    const theme = document.createElement('span');
    theme.textContent = p.theme;
    const sep2 = document.createTextNode(' · ');
    const mins = document.createElement('span');
    mins.className = 'muted';
    mins.textContent = p.totalMinutes + ' min';
    li.appendChild(day);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(date);
    li.appendChild(sep);
    li.appendChild(theme);
    li.appendChild(sep2);
    li.appendChild(mins);
    previewList.appendChild(li);
  }
}

async function loadSummary() {
  const r = await fetch('/api/me/summary');
  if (!r.ok) return;
  const s = await r.json();
  summaryMinutes.textContent = s.thisWeekMinutes;
  summaryTarget.textContent = s.weeklyTargetMinutes;
  summarySessions.textContent = s.thisWeekSessions;
  const pct = Math.min(100, s.percentOfTarget);
  summaryBar.style.width = pct + '%';
  summaryBar.classList.toggle('progress-bar--full', s.percentOfTarget >= 100);
  summaryStreak.textContent = s.streakDays + (s.streakDays === 1 ? ' day' : ' days');
  summaryStreak.classList.toggle('chip--active', s.streakDays > 0);
  summaryLast.textContent = s.lastWorkoutDate ? '· last on ' + s.lastWorkoutDate : '';

  const glyph = TREND_GLYPH[s.weekOverWeekTrend] || '·';
  const sign = s.weekOverWeekDeltaMinutes > 0 ? '+' : '';
  summaryTrend.textContent = `${glyph} ${sign}${s.weekOverWeekDeltaMinutes} min`;
  summaryTrend.className = 'chip chip--trend-' + s.weekOverWeekTrend;
  summaryLastWeek.textContent = `· last week ${s.lastWeekMinutes} min / ${s.lastWeekSessions} session(s)`;
  summaryCoach.textContent = s.weekCoachMessage || '';
  summaryCoach.className = 'coach-message coach-message--' + s.weekOverWeekTrend;

  summaryEl.hidden = false;
}

restButton.addEventListener('click', async () => {
  if (!confirm('Take today as a rest day?')) return;
  const r = await fetch('/api/me/today/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'failed' }));
    logStatus.textContent = 'Error: ' + (err.error || 'failed');
    return;
  }
  logStatus.textContent = '';
  await loadHistory();
  await loadSummary();
});

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
  await loadSummary();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileStatus.textContent = 'Saving…';
  const payload = {
    goal: form.elements['goal'].value,
    fitnessLevel: form.elements['fitnessLevel'].value,
    weeklyMinutes: parseInt(form.elements['weeklyMinutes'].value, 10) || 0,
    timezone: form.elements['timezone'].value.trim() || 'UTC',
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
  await loadSummary();
  await loadPreview();
});

(async () => {
  const me = await loadMe();
  if (!me) return;
  await loadProfile();
  await loadToday();
  await loadHistory();
  await loadSummary();
  await loadPreview();
})();
