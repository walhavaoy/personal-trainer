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
const historyMore = document.getElementById('history-more');
const historyFilter = document.getElementById('history-filter');

// Current theme filter, null = show all. Driven by the chip strip.
let currentThemeFilter = null;
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
const summaryBest = document.getElementById('summary-best');
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

function renderProfile(p) {
  if (!p) return;
  form.elements['goal'].value = p.goal;
  form.elements['fitnessLevel'].value = p.fitnessLevel;
  form.elements['weeklyMinutes'].value = p.weeklyMinutes;
  form.elements['timezone'].value = p.timezone || 'UTC';
}

async function loadProfile(prefetched) {
  let p = prefetched;
  if (!p) {
    const r = await fetch('/api/me/profile');
    if (!r.ok) return null;
    p = await r.json();
  }
  renderProfile(p);
  return p;
}

async function loadToday(prefetched) {
  let s = prefetched;
  if (!s) {
    const r = await fetch('/api/me/today');
    if (!r.ok) {
      sessionLoading.textContent = 'Could not load today’s session.';
      return;
    }
    s = await r.json();
  }
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

async function loadHistory(prefetched) {
  let workouts = prefetched;
  if (!workouts) {
    const qs = currentThemeFilter ? '?theme=' + encodeURIComponent(currentThemeFilter) : '';
    const r = await fetch('/api/me/workouts' + qs);
    if (!r.ok) {
      historyLoading.textContent = 'Could not load history.';
      return;
    }
    workouts = await r.json();
  }
  historyList.innerHTML = '';
  reflectTodayLogged(workouts);
  // Rebuild the theme filter chip strip from the *current* row set when no
  // filter is applied — that way it stays focused on themes the user actually
  // trains. When a filter is applied, keep the strip stable (don't rebuild)
  // so the user can switch back to "All".
  if (!currentThemeFilter) renderHistoryFilterStrip(workouts);
  if (workouts.length === 0) {
    historyLoading.hidden = true;
    historyEmpty.hidden = !currentThemeFilter; // "no workouts" only when unfiltered
    if (currentThemeFilter) {
      historyEmpty.hidden = false;
      historyEmpty.textContent = `No ${currentThemeFilter} sessions yet.`;
    } else {
      historyEmpty.textContent = "No workouts logged yet. Complete today's session to start your history.";
    }
    historyList.hidden = true;
    historyMore.hidden = true;
    return;
  }
  for (const w of workouts) {
    historyList.appendChild(renderHistoryItem(w));
  }
  // If we got the full page-size of 30, more might exist — offer to load.
  historyMore.hidden = workouts.length < 30;
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

async function loadTrend(prefetched) {
  let weeks = prefetched;
  if (!weeks) {
    const r = await fetch('/api/me/trend?weeks=8');
    if (!r.ok) return;
    weeks = await r.json();
  }
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

async function loadPreview(prefetched) {
  let items = prefetched;
  if (!items) {
    const r = await fetch('/api/me/preview?days=3');
    if (!r.ok) return;
    items = await r.json();
  }
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

async function loadSummary(prefetched) {
  let s = prefetched;
  if (!s) {
    const r = await fetch('/api/me/summary');
    if (!r.ok) return;
    s = await r.json();
  }
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

  // "Best week so far" milestone — only when we've actually exceeded a real
  // prior-week max (not just because there's no history yet).
  if (s.thisWeekMinutes > 0 && s.thisWeekMinutes > s.bestPriorWeekMinutes && s.bestPriorWeekMinutes > 0) {
    summaryBest.textContent = `Best week so far · +${s.thisWeekMinutes - s.bestPriorWeekMinutes} min over your previous high`;
    summaryBest.hidden = false;
  } else {
    summaryBest.hidden = true;
    summaryBest.textContent = '';
  }

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

function renderHistoryFilterStrip(workouts) {
  // Collect distinct themes, ordered by recency of first appearance.
  const seen = new Set();
  const order = [];
  for (const w of workouts) {
    if (!seen.has(w.theme)) { seen.add(w.theme); order.push(w.theme); }
  }
  historyFilter.innerHTML = '';
  // Only show the strip if there are 2+ themes to choose between.
  if (order.length < 2) { historyFilter.hidden = true; return; }
  historyFilter.hidden = false;
  const makeChip = (label, theme) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (currentThemeFilter === theme ? ' chip--active' : '');
    btn.textContent = label;
    btn.dataset.testid = 'pt-chip-theme';
    btn.addEventListener('click', async () => {
      currentThemeFilter = theme;
      await loadHistory();
    });
    return btn;
  };
  historyFilter.appendChild(makeChip('All', null));
  for (const t of order) historyFilter.appendChild(makeChip(t, t));
}

historyMore.addEventListener('click', async () => {
  const items = historyList.querySelectorAll('li[data-id]');
  const oldest = items[items.length - 1];
  if (!oldest) return;
  // Look up the date from the rendered row's title attribute on the date strong.
  const dateStrong = oldest.querySelector('strong[title]');
  const oldestDate = dateStrong?.getAttribute('title');
  if (!oldestDate || !/^\d{4}-\d{2}-\d{2}$/.test(oldestDate)) return;
  historyMore.disabled = true;
  historyMore.textContent = 'Loading…';
  try {
    const params = new URLSearchParams({ before: oldestDate });
    if (currentThemeFilter) params.set('theme', currentThemeFilter);
    const r = await fetch('/api/me/workouts?' + params.toString());
    if (!r.ok) { historyMore.textContent = 'Error — try again'; historyMore.disabled = false; return; }
    const older = await r.json();
    for (const w of older) historyList.appendChild(renderHistoryItem(w));
    historyMore.hidden = older.length < 30;
    historyMore.disabled = false;
    historyMore.textContent = 'Load older';
  } catch {
    historyMore.textContent = 'Error — try again';
    historyMore.disabled = false;
  }
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

// One fetch that returns everything the page needs. Falls back to the
// per-section endpoints if the batch one isn't available (e.g. a partial
// rollback to an older image where /api/me/dashboard doesn't exist yet).
async function loadDashboard() {
  const r = await fetch('/api/me/dashboard');
  if (r.status === 404) {
    // Legacy path: fan out the per-section loaders.
    const todayThenHistory = (async () => { await loadToday(); await loadHistory(); })();
    await Promise.all([loadProfile(), todayThenHistory, loadSummary(), loadTrend(), loadPreview()]);
    return;
  }
  if (!r.ok) return;
  const d = await r.json();

  // Renderers in dependency order: today first (sets logForm.dataset.date),
  // then history (uses that date for "already logged" detection).
  await loadProfile(d.profile);
  await loadToday(d.today);
  await loadHistory(d.workouts);
  await loadSummary(d.summary);
  await loadTrend(d.trend);
  await loadPreview(d.preview);

  // Profile-on-UTC auto-detect: if the saved tz is UTC but the browser knows a
  // real zone, push it once. Done here (post-dashboard) instead of inside
  // loadProfile so it doesn't fire before everything else has rendered.
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browserTz && browserTz !== 'UTC' && (d.profile.timezone === 'UTC' || !d.profile.timezone)) {
    const r2 = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: browserTz }),
    });
    if (r2.ok) {
      const p2 = await r2.json();
      form.elements['timezone'].value = p2.timezone;
    }
  }
}

(async () => {
  const me = await loadMe();
  if (!me) return;
  await loadDashboard();
})();
