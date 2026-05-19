const whoEl = document.getElementById('who');
const firstNameEl = document.getElementById('firstName');
const sessionLoading = document.getElementById('session-loading');
const sessionEl = document.getElementById('session');
const sessionDay = document.getElementById('session-day');
const sessionTheme = document.getElementById('session-theme');
const sessionTotal = document.getElementById('session-total');
const sessionBlocks = document.getElementById('session-blocks');
const trainerNote = document.getElementById('trainer-note');
const previousSessionEl = document.getElementById('previous-session');
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
const resetButton = document.getElementById('reset-button');
const resetStatus = document.getElementById('reset-status');
const backfillForm = document.getElementById('backfill-form');
const backfillPrescription = document.getElementById('backfill-prescription');
const backfillStatus = document.getElementById('backfill-status');

const TREND_GLYPH = { up: '↑', down: '↓', flat: '→', new: '·' };

// "today" / "yesterday" / "tomorrow" / "Mon" / "May 11" — chooses the most
// readable form based on how recent or near-future the ISO date is.
function relativeDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const todayIso = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(iso) - Date.parse(todayIso)) / 86400000);
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  const dt = new Date(iso + 'T12:00:00Z');
  if (days >= -6 && days <= 6) {
    return dt.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  if (s.previousSession) {
    const p = s.previousSession;
    previousSessionEl.textContent = `Last ${s.theme}: ${p.completedMinutes}/${p.plannedMinutes} min · ${relativeDate(p.date)}`;
    previousSessionEl.title = p.date;
    previousSessionEl.hidden = false;
  } else {
    previousSessionEl.hidden = true;
    previousSessionEl.textContent = '';
  }
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
        const lbl = document.createElement('label');
        lbl.className = 'exercise-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'exercisesCompleted';
        cb.value = ex.name;
        cb.dataset.testid = 'pt-check-exercise';
        const span = document.createElement('span');
        span.textContent = ' ' + ex.prescription;
        lbl.appendChild(cb);
        lbl.appendChild(span);
        ei.appendChild(lbl);
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

// One-line trainer reaction to a completed workout. Pure function of the row.
function postWorkoutFeedback(w) {
  if (w.theme === 'Rest') return 'Recovery counts as training.';
  const planned = Math.max(1, w.plannedMinutes || 0);
  const ratio = (w.completedMinutes || 0) / planned;
  const exDone = Array.isArray(w.exercisesCompleted) ? w.exercisesCompleted.length : 0;

  let reaction;
  if (ratio >= 1.0)       reaction = exDone > 0
    ? `Strong session — target met and ${exDone} exercise${exDone === 1 ? '' : 's'} checked.`
    : 'Strong session — target met.';
  else if (ratio >= 0.8)  reaction = 'Solid — most of it done.';
  else if (ratio >= 0.5)  reaction = 'Got the main work in.';
  else if (w.completedMinutes > 0) reaction = 'Counts. Tomorrow we go again.';
  else                    reaction = 'Logged at zero — own it and aim higher tomorrow.';
  return reaction;
}

function reflectTodayLogged(workouts) {
  // Date the user is *currently looking at* — pulled from the loaded session.
  const today = logForm.dataset.date;
  if (!today) return;
  const t = workouts.find((w) => w.date === today);
  if (t) {
    logForm.hidden = true;
    logDone.hidden = false;
    const headline = t.theme === 'Rest'
      ? `Rest day taken — nothing logged today.`
      : `Logged today: ${t.completedMinutes}/${t.plannedMinutes} min · ${t.theme}`;
    logDone.innerHTML = '';
    const head = document.createElement('div');
    head.textContent = headline;
    const feedback = document.createElement('div');
    feedback.className = 'muted log-done-feedback';
    feedback.dataset.testid = 'pt-text-feedback';
    feedback.textContent = postWorkoutFeedback(t);
    logDone.appendChild(head);
    logDone.appendChild(feedback);
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
  // When we have exercise check data, show N/M alongside the minute count
  const exDone = Array.isArray(w.exercisesCompleted) ? w.exercisesCompleted.length : 0;
  const exCount = exDone > 0
    ? ' · <span class="muted">' + exDone + ' exercise' + (exDone === 1 ? '' : 's') + '</span>'
    : '';
  // Relative-date label, ISO date in title for unambiguous reference on hover.
  const rel = relativeDate(w.date);
  summary.innerHTML = '<strong title="' + w.date + '">' + rel + '</strong> · ' + w.theme + ' · '
    + '<span class="completed-min">' + w.completedMinutes + '</span>/' + w.plannedMinutes + ' min'
    + exCount;
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

async function loadTrend() {
  const r = await fetch('/api/me/trend?weeks=8');
  if (!r.ok) return;
  const weeks = await r.json();
  const svg = document.getElementById('summary-trend-svg');
  svg.innerHTML = '';
  if (weeks.length === 0) return;

  const W = 160, H = 40, GAP = 2;
  const colW = (W - GAP * (weeks.length - 1)) / weeks.length;
  // Cap the bar height at 200% of target so a single huge week doesn't squash the rest.
  const maxRatio = Math.max(1, ...weeks.map((w) => Math.min(2, w.percentOfTarget / 100)));
  const NS = 'http://www.w3.org/2000/svg';
  weeks.forEach((w, i) => {
    const ratio = Math.min(2, w.percentOfTarget / 100);
    const h = Math.max(2, Math.round((ratio / maxRatio) * (H - 2)));
    const x = Math.round(i * (colW + GAP));
    const y = H - h;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(Math.max(1, Math.round(colW))));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', '1');
    let fill = '#3a4150';      // grey: <50% of target
    if (ratio >= 1) fill = '#6ee7b7';        // green: hit or exceeded
    else if (ratio >= 0.5) fill = '#f5b041'; // amber: half to target
    rect.setAttribute('fill', fill);
    const title = document.createElementNS(NS, 'title');
    title.textContent = `${w.weekStart}: ${w.totalMinutes} min (${w.percentOfTarget}% of target), ${w.sessions} session(s)`;
    rect.appendChild(title);
    svg.appendChild(rect);
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
    day.textContent = relativeDate(p.date);
    day.title = p.date;
    const sep = document.createTextNode(' · ');
    const theme = document.createElement('span');
    theme.textContent = p.theme;
    const sep2 = document.createTextNode(' · ');
    const mins = document.createElement('span');
    mins.className = 'muted';
    mins.textContent = p.totalMinutes + ' min';
    li.appendChild(day);
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

// When the date input changes, fetch the prescribed session for that date
// so the user knows what they were supposed to do before they fill in minutes.
backfillForm.elements['date'].addEventListener('change', async () => {
  const d = backfillForm.elements['date'].value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    backfillPrescription.textContent = '';
    return;
  }
  const r = await fetch('/api/me/session?date=' + encodeURIComponent(d));
  if (!r.ok) {
    backfillPrescription.textContent = '';
    return;
  }
  const s = await r.json();
  if (s.theme === 'Rest') {
    backfillPrescription.textContent = `${s.dayOfWeek} was a Rest day. Leave minutes at 0 to log a rest.`;
    backfillForm.elements['completedMinutes'].value = 0;
  } else {
    backfillPrescription.textContent = `${s.dayOfWeek} · ${s.theme} · ${s.totalMinutes} min planned`;
    backfillForm.elements['completedMinutes'].value = s.totalMinutes;
  }
});

backfillForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  backfillStatus.textContent = 'Saving…';
  const payload = {
    date: backfillForm.elements['date'].value,
    completedMinutes: parseInt(backfillForm.elements['completedMinutes'].value, 10) || 0,
    notes: backfillForm.elements['notes'].value || undefined,
  };
  const r = await fetch('/api/me/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'failed' }));
    backfillStatus.textContent = 'Error: ' + (err.error || 'failed');
    return;
  }
  backfillStatus.textContent = 'Saved.';
  backfillForm.elements['notes'].value = '';
  await loadHistory();
  await loadSummary();
  await loadTrend();
});

resetButton.addEventListener('click', async () => {
  const phrase = prompt('Type DELETE to wipe every workout you have logged. This cannot be undone.');
  if (phrase !== 'DELETE') return;
  resetStatus.textContent = 'Deleting…';
  const r = await fetch('/api/me/workouts', {
    method: 'DELETE',
    headers: { 'X-Confirm-Delete-All': 'yes' },
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'failed' }));
    resetStatus.textContent = 'Error: ' + (err.error || 'failed');
    return;
  }
  const out = await r.json();
  resetStatus.textContent = `Deleted ${out.deleted} workout(s).`;
  await loadHistory();
  await loadSummary();
  await loadTrend();
});

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
  await loadTrend();
});

logForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  logStatus.textContent = 'Saving…';
  const checks = Array.from(document.querySelectorAll('input[name="exercisesCompleted"]:checked'))
    .map((cb) => cb.value);
  const payload = {
    date: logForm.dataset.date,
    completedMinutes: parseInt(logForm.elements['completedMinutes'].value, 10) || 0,
    notes: logForm.elements['notes'].value || undefined,
    exercisesCompleted: checks,
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
  await loadTrend();
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
  await loadTrend();
  await loadPreview();
})();
