/* Personal Trainer — modern SPA front-end.
 *
 * Hash-routed views: #/ dashboard, #/cardio, #/gym, #/me.
 * Talks to:
 *   GET    /api/me                — user identity
 *   GET    /api/me/profile        — profile read
 *   PUT    /api/me/profile        — profile update
 *   POST   /api/me/profile/reset
 *   GET    /api/me/dashboard      — batch read: profile + summary + planned + recentGym + workouts + trend
 *   GET    /api/me/activities?kind=&status=  — list activities (walk/run/cycle/gym/rest/...)
 *   POST   /api/me/activities     — create activity (planned or completed)
 *   PATCH  /api/me/activities/:id — edit / mark completed
 *   DELETE /api/me/workouts/:id   — delete activity row (back-compat endpoint)
 *   GET    /api/me/gym            — list gym sessions
 *   POST   /api/me/gym            — create gym session w/ sets
 *   PATCH  /api/me/gym/:id        — update
 *   DELETE /api/me/gym/:id        — delete
 *   GET    /api/me/workouts.csv   — export
 *   DELETE /api/me/workouts       — wipe (needs X-Confirm-Delete-All header)
 */

const ICONS = { walk: '🚶', run: '🏃', cycle: '🚴', gym: '🏋️', rest: '🛏️', mobility: '🧘', cardio: '❤️', other: '✨' };
const TREND_GLYPH = { up: '↑', down: '↓', flat: '→', new: '·' };

// All user-visible strings go through i18n.t(). Use kindLabel() so a kind
// without an explicit catalog entry still falls back to the raw key.
const t = (k, vars) => window.i18n.t(k, vars);
const kindLabel = (kind) => t('kind.' + (kind || 'other'));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  profile: null,
  dashboard: null,
  cardioFilter: 'all',
};

/* ---------- utilities ---------- */

function relativeDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const todayIso = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(iso) - Date.parse(todayIso)) / 86400000);
  if (days === 0) return t('date.today');
  if (days === -1) return t('date.yesterday');
  if (days === 1) return t('date.tomorrow');
  // Use the current locale for weekday/month formatting so the chrome matches
  // the chosen UI language (e.g. "ma" / "Mon").
  const locale = (window.i18n && window.i18n.currentLocale()) || undefined;
  const dt = new Date(iso + 'T12:00:00Z');
  if (days >= -6 && days <= 6) return dt.toLocaleDateString(locale, { weekday: 'short' });
  return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || `HTTP ${r.status}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

/* ---------- routing ---------- */

const ROUTES = ['dashboard', 'cardio', 'gym', 'me'];

function currentRoute() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const name = raw.split('/')[0] || 'dashboard';
  return ROUTES.includes(name) ? name : 'dashboard';
}

function showView(name) {
  for (const v of $$('.view')) {
    v.hidden = v.dataset.view !== name;
  }
  for (const b of $$('.tabbar__btn')) {
    b.classList.toggle('is-active', b.dataset.tab === name);
  }
  // Refresh per-view content if cached state exists.
  if (name === 'cardio') renderCardioView();
  else if (name === 'gym') renderGymView();
  else if (name === 'me') renderMeView();
  // Dashboard is rendered eagerly on load; nothing to do.
}

window.addEventListener('hashchange', () => showView(currentRoute()));

/* ---------- identity / profile load ---------- */

async function loadMe() {
  try {
    const me = await api('/api/me');
    const display = me.fullName || me.username;
    $('#firstName').textContent = display ? display.split(/\s+/)[0] : t('app.athlete');
    $('#who').textContent = me.email ? me.email : '';
    return me;
  } catch {
    $('#firstName').textContent = '';
    $('#greeting').textContent = 'Not signed in';
    return null;
  }
}

// When the locale changes (user picks a new one), re-render the dashboard's
// dynamically-built bits so coach/lifetime/labels pick up the new strings.
document.addEventListener('i18n:change', () => {
  if (!state.dashboard) return;
  renderHero(state.dashboard.summary, state.dashboard.lifetime);
  renderPlanned(state.dashboard.planned || []);
  renderRecent(state.dashboard.workouts || [], state.dashboard.recentGym || []);
  if (currentRoute() === 'cardio') renderCardioView();
  if (currentRoute() === 'gym') renderGymView();
});

function renderProfile(p) {
  if (!p) return;
  state.profile = p;
  const f = $('#profile-form');
  f.elements['goal'].value = p.goal;
  f.elements['fitnessLevel'].value = p.fitnessLevel;
  f.elements['weeklyMinutes'].value = p.weeklyMinutes;
  f.elements['timezone'].value = p.timezone || 'UTC';
  f.elements['displayName'].value = p.displayName || '';
  // Reflect server-side locale in the picker. Falls back to whatever i18n
  // resolved at boot (browser default) when the profile has no preference yet.
  const localeSel = f.elements['locale'];
  if (localeSel) localeSel.value = p.locale || window.i18n.currentLocale();
  if (p.displayName) {
    $('#firstName').textContent = p.displayName.split(/\s+/)[0];
  } else {
    // No display name override → use the i18n default "athlete" greeting noun.
    $('#firstName').textContent = t('app.athlete');
  }
}

/* ---------- dashboard ---------- */

async function loadDashboard() {
  try {
    const d = await api('/api/me/dashboard');
    state.dashboard = d;
    renderProfile(d.profile);
    renderHero(d.summary, d.lifetime);
    renderTrend(d.trend);
    renderPlanned(d.planned || []);
    renderRecent(d.workouts || [], d.recentGym || []);
    renderOnboarding(d.lifetime);
    // Profile-on-UTC auto-detect (preserved from original).
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== 'UTC' && (d.profile.timezone === 'UTC' || !d.profile.timezone)) {
      const updated = await api('/api/me/profile', { method: 'PUT', body: JSON.stringify({ timezone: browserTz }) }).catch(() => null);
      if (updated) renderProfile(updated);
    }
  } catch (e) {
    console.error('dashboard load failed', e);
  }
}

function renderOnboarding(lifetime) {
  const ob = $('#onboarding');
  if (!ob) return;
  ob.hidden = !!(lifetime && lifetime.totalSessions > 0);
}

function renderHero(s, lifetime) {
  if (!s) return;
  $('#summary-card').hidden = false;
  $('#summary-minutes').textContent = s.thisWeekMinutes;
  $('#summary-target').textContent = s.weeklyTargetMinutes;
  $('#summary-sessions').textContent = s.thisWeekSessions;
  const pct = Math.min(100, s.percentOfTarget);
  $('#summary-bar').style.width = pct + '%';
  $('#summary-bar').classList.toggle('progress-bar--full', s.percentOfTarget >= 100);
  $('#summary-streak-days').textContent = s.streakDays;
  $('#summary-streak-unit').textContent = t(s.streakDays === 1 ? 'dashboard.hero.day' : 'dashboard.hero.days');
  document.title = s.streakDays > 0 ? `🔥 ${s.streakDays} · Personal Trainer` : 'Personal Trainer';
  const flameWrap = $('#summary-streak-icon').parentElement;
  flameWrap.classList.toggle('streak-active', s.streakDays > 0);

  const glyph = TREND_GLYPH[s.weekOverWeekTrend] || '·';
  const sign = s.weekOverWeekDeltaMinutes > 0 ? '+' : '';
  $('#summary-trend').textContent = `${glyph} ${sign}${s.weekOverWeekDeltaMinutes} min`;
  $('#summary-last-week').textContent = t('dashboard.hero.vsLast', { n: s.lastWeekMinutes });
  const pill = $('#summary-trend-pill');
  pill.classList.remove('hero-pill--up', 'hero-pill--down', 'hero-pill--flat', 'hero-pill--new');
  pill.classList.add('hero-pill--' + s.weekOverWeekTrend);

  const coach = $('#summary-coach');
  // Prefer the backend's i18n key + params so the line follows the user's
  // chosen language. Falls back to the English-rendered message when older
  // backends don't ship a key.
  coach.textContent = s.weekCoachKey
    ? t(s.weekCoachKey, s.weekCoachParams || {})
    : (s.weekCoachMessage || '');
  coach.classList.remove('hero-coach--up', 'hero-coach--down');
  if (s.weekOverWeekTrend === 'up') coach.classList.add('hero-coach--up');
  if (s.weekOverWeekTrend === 'down') coach.classList.add('hero-coach--down');

  const minPB = s.thisWeekMinutes > 0 && s.thisWeekMinutes > s.bestPriorWeekMinutes && s.bestPriorWeekMinutes > 0;
  const distPB = s.thisWeekDistanceKm > 0 && s.thisWeekDistanceKm > s.bestPriorWeekDistanceKm && s.bestPriorWeekDistanceKm > 0;
  const best = $('#summary-best');
  if (minPB || distPB) {
    const parts = [];
    if (minPB) parts.push(`+${s.thisWeekMinutes - s.bestPriorWeekMinutes} min`);
    if (distPB) parts.push(`+${Math.round((s.thisWeekDistanceKm - s.bestPriorWeekDistanceKm) * 10) / 10} km`);
    best.textContent = `Best week so far · ${parts.join(' & ')} over your previous high`;
    best.hidden = false;
  } else {
    best.hidden = true;
  }

  if (lifetime && lifetime.totalSessions > 0) {
    const sl = $('#summary-lifetime');
    const sessionsLabel = t(lifetime.totalSessions === 1
      ? 'dashboard.lifetime.session'
      : 'dashboard.lifetime.sessions');
    let text = t('dashboard.lifetime', {
      minutes: lifetime.totalMinutes.toLocaleString(),
      sessions: lifetime.totalSessions,
      sessionsLabel,
    });
    if (lifetime.totalDistanceKm > 0) text += ` · ${lifetime.totalDistanceKm.toLocaleString()} km`;
    sl.textContent = text;
    sl.hidden = false;
  }
}

function renderTrend(weeks) {
  const svg = $('#summary-trend-svg');
  svg.innerHTML = '';
  if (!Array.isArray(weeks) || weeks.length === 0) return;
  const W = 320, H = 80, GAP = 4;
  const colW = (W - GAP * (weeks.length - 1)) / weeks.length;
  const maxRatio = Math.max(1, ...weeks.map((w) => Math.min(2, w.percentOfTarget / 100)));
  const NS = 'http://www.w3.org/2000/svg';
  weeks.forEach((w, i) => {
    const ratio = Math.min(2, w.percentOfTarget / 100);
    const h = Math.max(3, Math.round((ratio / maxRatio) * (H - 4)));
    const x = Math.round(i * (colW + GAP));
    const y = H - h;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(Math.max(2, Math.round(colW))));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', '3');
    let fill = '#3a4150';
    if (ratio >= 1) fill = '#6ee7b7';
    else if (ratio >= 0.5) fill = '#f5b041';
    rect.setAttribute('fill', fill);
    const title = document.createElementNS(NS, 'title');
    title.textContent = `${w.weekStart}: ${w.totalMinutes} min (${w.percentOfTarget}% of target), ${w.sessions} session(s)`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });
  // Axis labels: show first weekStart at left, "this week" at right.
  $('#trend-axis-oldest').textContent = weeks[0]?.weekStart || '';
}

function renderPlanned(planned) {
  const card = $('#planned-card');
  const list = $('#planned-list');
  list.innerHTML = '';
  if (!planned.length) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  for (const a of planned) {
    list.appendChild(renderActivityItem(a, { showActions: true, plannedView: true }));
  }
}

function renderRecent(workouts, gyms) {
  const loading = $('#dashboard-recent-loading');
  const ul = $('#dashboard-recent');
  const empty = $('#dashboard-recent-empty');
  loading.hidden = true;
  ul.innerHTML = '';
  const merged = [];
  for (const w of workouts) {
    if (w.status === 'planned') continue;
    // Suppress mirror gym rows — they'll appear via the gym list below.
    if (w.kind === 'gym' && gyms.some((g) => g.workoutId === w.id)) continue;
    merged.push({ kind: 'activity', date: w.date, data: w });
  }
  for (const g of gyms) {
    if (g.status === 'planned') continue;
    merged.push({ kind: 'gym', date: g.date, data: g });
  }
  merged.sort((a, b) => b.date.localeCompare(a.date));
  const recent = merged.slice(0, 8);
  if (recent.length === 0) {
    ul.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  ul.hidden = false;
  for (const item of recent) {
    if (item.kind === 'activity') {
      ul.appendChild(renderActivityItem(item.data, { showActions: false }));
    } else {
      ul.appendChild(renderGymRecentItem(item.data));
    }
  }
}

function renderActivityItem(a, { showActions, plannedView } = {}) {
  const li = document.createElement('li');
  li.className = 'activity-item';
  li.dataset.id = a.id;
  li.dataset.testid = 'pt-row-activity';
  const kind = a.kind || 'other';
  const icon = document.createElement('span');
  icon.className = 'activity-item__icon activity-item__icon--' + kind;
  icon.textContent = ICONS[kind] || '✨';
  const main = document.createElement('div');
  main.className = 'activity-item__main';
  const title = document.createElement('div');
  title.className = 'activity-item__title';
  const dist = (typeof a.distanceKm === 'number' && a.distanceKm > 0)
    ? ` · ${a.distanceKm} km`
    : (a.status === 'planned' && typeof a.plannedDistanceKm === 'number' && a.plannedDistanceKm > 0
       ? ` · ${a.plannedDistanceKm} km` : '');
  const mins = a.status === 'planned'
    ? (a.plannedMinutes ? ` · ${a.plannedMinutes} min` : '')
    : ` · ${a.completedMinutes}/${a.plannedMinutes} min`;
  title.innerHTML = `<strong>${escapeHtml(kindLabel(kind) || a.theme)}</strong>${dist}${mins}`;
  const sub = document.createElement('div');
  sub.className = 'activity-item__sub';
  sub.textContent = relativeDate(a.date) + (a.notes ? ' · ' + a.notes : '');
  main.appendChild(title);
  main.appendChild(sub);
  li.appendChild(icon);
  li.appendChild(main);

  if (a.status === 'planned') {
    const tag = document.createElement('span');
    tag.className = 'activity-status activity-status--planned';
    tag.textContent = t('activity.planned');
    li.appendChild(tag);
  }

  if (showActions) {
    const actions = document.createElement('div');
    actions.className = 'activity-item__actions';
    if (a.status === 'planned') {
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'link-btn link-btn--accent';
      done.textContent = t('activity.markDone');
      done.dataset.testid = 'pt-button-mark-done';
      done.addEventListener('click', async () => {
        try {
          await api('/api/me/activities/' + a.id, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'completed',
              completedMinutes: a.plannedMinutes,
              ...(a.plannedDistanceKm != null ? { distanceKm: a.plannedDistanceKm } : {}),
            }),
          });
          await loadDashboard();
        } catch (e) { alert('Failed: ' + e.message); }
      });
      actions.appendChild(done);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'link-btn link-btn--danger';
    del.textContent = t('activity.delete');
    del.dataset.testid = 'pt-button-delete';
    del.addEventListener('click', async () => {
      if (!confirm(t('activity.confirm.delete', { kind: kindLabel(kind), date: a.date }))) return;
      try {
        await api('/api/me/workouts/' + a.id, { method: 'DELETE' });
        await loadDashboard();
        if (currentRoute() === 'cardio') renderCardioView();
      } catch (e) { alert('Delete failed: ' + e.message); }
    });
    actions.appendChild(del);
    li.appendChild(actions);
  }
  void plannedView; // currently unused; kept for future styling hooks
  return li;
}

function renderGymRecentItem(g) {
  const li = document.createElement('li');
  li.className = 'activity-item';
  li.dataset.testid = 'pt-row-activity';
  const icon = document.createElement('span');
  icon.className = 'activity-item__icon activity-item__icon--gym';
  icon.textContent = ICONS.gym;
  const main = document.createElement('div');
  main.className = 'activity-item__main';
  const title = document.createElement('div');
  title.className = 'activity-item__title';
  const setsCount = g.exercises.reduce((n, e) => n + e.sets.length, 0);
  title.innerHTML = `<strong>${escapeHtml(g.name)}</strong> · ${escapeHtml(t('gym.shortLine', { count: g.exercises.length, sets: setsCount }))}`;
  const sub = document.createElement('div');
  sub.className = 'activity-item__sub';
  sub.textContent = relativeDate(g.date) + (g.notes ? ' · ' + g.notes : '');
  main.appendChild(title);
  main.appendChild(sub);
  li.appendChild(icon);
  li.appendChild(main);
  return li;
}

/* ---------- Cardio view ---------- */

async function renderCardioView() {
  const filterBar = $('#cardio-kind-filter');
  if (filterBar && !filterBar.dataset.bound) {
    filterBar.dataset.bound = '1';
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cardio-filter]');
      if (!btn) return;
      state.cardioFilter = btn.dataset.cardioFilter;
      for (const b of $$('[data-cardio-filter]', filterBar)) {
        b.classList.toggle('is-active', b === btn);
      }
      renderCardioView();
    });
  }
  const loading = $('#cardio-history-loading');
  const list = $('#cardio-history-list');
  const empty = $('#cardio-history-empty');
  const plannedCard = $('#cardio-planned-card');
  const plannedList = $('#cardio-planned-list');
  loading.hidden = false;
  list.hidden = true;
  empty.hidden = true;

  const kindParam = state.cardioFilter === 'all' ? 'cardio_any' : state.cardioFilter;
  try {
    const activities = await api(`/api/me/activities?kind=${kindParam}`);
    loading.hidden = true;

    const planned = activities.filter((a) => a.status === 'planned');
    const done = activities.filter((a) => a.status !== 'planned');

    plannedList.innerHTML = '';
    if (planned.length > 0) {
      plannedCard.hidden = false;
      for (const a of planned) plannedList.appendChild(renderActivityItem(a, { showActions: true, plannedView: true }));
    } else {
      plannedCard.hidden = true;
    }

    list.innerHTML = '';
    if (done.length === 0) {
      empty.hidden = false;
      return;
    }
    for (const a of done) list.appendChild(renderActivityItem(a, { showActions: true }));
    list.hidden = false;
  } catch (e) {
    loading.textContent = 'Could not load: ' + e.message;
  }
}

/* ---------- Gym view ---------- */

async function renderGymView() {
  const loading = $('#gym-list-loading');
  const list = $('#gym-list');
  const empty = $('#gym-list-empty');
  loading.hidden = false;
  list.hidden = true;
  empty.hidden = true;
  try {
    const gyms = await api('/api/me/gym');
    loading.hidden = true;
    list.innerHTML = '';
    if (gyms.length === 0) { empty.hidden = false; return; }
    for (const g of gyms) list.appendChild(renderGymItem(g));
    list.hidden = false;
  } catch (e) {
    loading.textContent = 'Could not load: ' + e.message;
  }
}

function renderGymItem(g) {
  const li = document.createElement('li');
  li.className = 'gym-item';
  li.dataset.id = g.id;
  li.dataset.testid = 'pt-row-gym';

  const head = document.createElement('div');
  head.className = 'gym-item__head';
  const title = document.createElement('div');
  title.className = 'gym-item__title';
  title.textContent = g.name;
  const meta = document.createElement('div');
  meta.className = 'gym-item__meta';
  const setsCount = g.exercises.reduce((n, e) => n + e.sets.length, 0);
  meta.textContent = t('gym.sessionLine', { date: relativeDate(g.date), count: g.exercises.length, sets: setsCount });
  head.appendChild(title);
  head.appendChild(meta);
  li.appendChild(head);

  if (g.status === 'planned') {
    const tag = document.createElement('span');
    tag.className = 'activity-status activity-status--planned';
    tag.textContent = t('activity.planned');
    head.appendChild(tag);
  }

  const body = document.createElement('div');
  body.className = 'gym-item__body';
  for (const ex of g.exercises) {
    const row = document.createElement('div');
    row.className = 'gym-item__exercise';
    const sets = ex.sets.map((s) => {
      if (s.weightKg && s.weightKg > 0) return `${s.weightKg}kg × ${s.reps}`;
      return `${s.reps}`;
    }).join(', ');
    row.innerHTML = `<strong>${escapeHtml(ex.name)}</strong> · <span class="muted">${escapeHtml(sets)}</span>`;
    body.appendChild(row);
  }
  if (g.notes) {
    const n = document.createElement('div');
    n.className = 'muted';
    n.style.fontSize = '0.85rem';
    n.style.marginTop = '0.25rem';
    n.textContent = g.notes;
    body.appendChild(n);
  }
  li.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'gym-item__actions';
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'link-btn link-btn--accent';
  editBtn.textContent = t('activity.edit');
  editBtn.dataset.testid = 'pt-button-edit-gym';
  editBtn.addEventListener('click', () => openGymSheet(g));
  const repeatBtn = document.createElement('button');
  repeatBtn.type = 'button';
  repeatBtn.className = 'link-btn';
  repeatBtn.textContent = t('activity.repeat');
  repeatBtn.dataset.testid = 'pt-button-repeat-gym';
  repeatBtn.addEventListener('click', () => openGymSheet({ ...g, id: null, date: todayIso(), status: 'completed' }));
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'link-btn link-btn--danger';
  delBtn.textContent = t('activity.delete');
  delBtn.dataset.testid = 'pt-button-delete-gym';
  delBtn.addEventListener('click', async () => {
    if (!confirm(t('gym.confirm.delete', { name: g.name, date: g.date }))) return;
    try {
      await api('/api/me/gym/' + g.id, { method: 'DELETE' });
      await loadDashboard();
      renderGymView();
    } catch (e) { alert('Delete failed: ' + e.message); }
  });
  actions.appendChild(editBtn);
  actions.appendChild(repeatBtn);
  actions.appendChild(delBtn);
  li.appendChild(actions);
  return li;
}

/* ---------- Me view ---------- */

function renderMeView() {
  // Profile is already loaded by loadDashboard via renderProfile.
  if (!state.profile) {
    // Lazy fetch if user lands on /me first (rare).
    api('/api/me/profile').then(renderProfile).catch(() => undefined);
  }
}

/* ---------- Sheet (modal) ---------- */

function openSheet(title, contentNode) {
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.innerHTML = '';
  body.appendChild(contentNode);
  // Localize the freshly-inserted template subtree so static text + placeholders
  // pick up the active locale before the sheet animates in.
  window.i18n.applyDom(body);
  const sheet = $('#sheet');
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const sheet = $('#sheet');
  sheet.hidden = true;
  sheet.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sheet-close]')) closeSheet();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

/* ---------- Cardio sheet ---------- */

function openCardioSheet(kindHint) {
  const tpl = $('#tpl-cardio-form').content.cloneNode(true);
  const form = tpl.querySelector('form');
  if (kindHint) {
    const radio = form.querySelector(`input[name="kind"][value="${kindHint}"]`);
    if (radio) radio.checked = true;
  }
  form.elements['date'].value = todayIso();
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = form.elements['mode'].value;
    const kind = form.elements['kind'].value;
    const date = form.elements['date'].value;
    const distance = parseFloat(form.elements['distance'].value);
    const minutes = parseInt(form.elements['minutes'].value, 10);
    const notes = form.elements['notes'].value || null;
    const payload = { kind, date, status, notes };
    if (status === 'planned') {
      if (Number.isFinite(minutes) && minutes > 0) payload.plannedMinutes = minutes;
      if (Number.isFinite(distance) && distance > 0) payload.plannedDistanceKm = distance;
    } else {
      payload.completedMinutes = Number.isFinite(minutes) ? minutes : 0;
      payload.plannedMinutes = payload.completedMinutes; // align planned to completed for a one-shot log
      if (Number.isFinite(distance) && distance > 0) payload.distanceKm = distance;
    }
    const status$ = form.querySelector('[data-status]');
    status$.textContent = t('sheet.saving');
    status$.classList.remove('sheet-status--err', 'sheet-status--ok');
    try {
      await api('/api/me/activities', { method: 'POST', body: JSON.stringify(payload) });
      status$.textContent = t('sheet.saved');
      status$.classList.add('sheet-status--ok');
      await loadDashboard();
      if (currentRoute() === 'cardio') await renderCardioView();
      closeSheet();
    } catch (e) {
      status$.textContent = t('sheet.error', { msg: e.message });
      status$.classList.add('sheet-status--err');
    }
  });
  openSheet(t('sheet.cardio.title'), tpl);
}

/* ---------- Gym sheet ---------- */

function openGymSheet(existing) {
  const tpl = $('#tpl-gym-form').content.cloneNode(true);
  const form = tpl.querySelector('form');
  const exContainer = form.querySelector('[data-exercises]');

  const isEdit = !!(existing && existing.id);

  form.elements['date'].value = existing?.date || todayIso();
  form.elements['name'].value = existing?.name || '';
  form.elements['notes'].value = existing?.notes || '';
  if (existing?.status === 'planned') {
    form.querySelector('input[name="mode"][value="planned"]').checked = true;
  }

  function addExercise(ex) {
    const tex = $('#tpl-gym-exercise').content.cloneNode(true);
    const exNode = tex.querySelector('[data-exercise]');
    const nameInput = exNode.querySelector('input[name="exerciseName"]');
    if (ex?.name) nameInput.value = ex.name;
    const setsBox = exNode.querySelector('[data-sets]');
    function addSet(s) {
      const tset = $('#tpl-gym-set').content.cloneNode(true);
      const setNode = tset.querySelector('[data-set]');
      if (s) {
        setNode.querySelector('input[name="reps"]').value = s.reps ?? '';
        setNode.querySelector('input[name="weight"]').value = (s.weightKg != null ? s.weightKg : '');
      }
      setNode.querySelector('[data-remove-set]').addEventListener('click', () => {
        setNode.remove();
        renumberSets(setsBox);
      });
      setsBox.appendChild(setNode);
      renumberSets(setsBox);
    }
    if (ex?.sets?.length) {
      for (const s of ex.sets) addSet(s);
    } else {
      addSet({ reps: '', weightKg: '' });
    }
    exNode.querySelector('[data-add-set]').addEventListener('click', () => addSet());
    exNode.querySelector('[data-remove-exercise]').addEventListener('click', () => exNode.remove());
    exContainer.appendChild(exNode);
  }

  function renumberSets(setsBox) {
    const sets = setsBox.querySelectorAll('[data-set]');
    sets.forEach((s, i) => { s.querySelector('[data-set-n]').textContent = String(i + 1); });
  }

  if (existing?.exercises?.length) {
    for (const ex of existing.exercises) addExercise(ex);
  } else {
    addExercise();
  }

  form.querySelector('[data-add-exercise]').addEventListener('click', () => addExercise());

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = form.elements['mode'].value;
    const name = form.elements['name'].value.trim() || 'Gym session';
    const date = form.elements['date'].value;
    const notes = form.elements['notes'].value || null;
    const exercises = [];
    for (const exNode of form.querySelectorAll('[data-exercise]')) {
      const exName = exNode.querySelector('input[name="exerciseName"]').value.trim();
      if (!exName) continue;
      const sets = [];
      for (const setNode of exNode.querySelectorAll('[data-set]')) {
        const reps = parseInt(setNode.querySelector('input[name="reps"]').value, 10);
        const wStr = setNode.querySelector('input[name="weight"]').value;
        const weightKg = wStr === '' ? null : parseFloat(wStr);
        if (!Number.isFinite(reps) || reps < 0) continue;
        sets.push({ reps, weightKg: Number.isFinite(weightKg) ? weightKg : null });
      }
      if (sets.length === 0) continue;
      exercises.push({ name: exName, sets });
    }
    const status$ = form.querySelector('[data-status]');
    status$.textContent = t('sheet.saving');
    status$.classList.remove('sheet-status--err', 'sheet-status--ok');
    try {
      const payload = { date, name, notes, status, exercises };
      if (isEdit) {
        await api('/api/me/gym/' + existing.id, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/api/me/gym', { method: 'POST', body: JSON.stringify(payload) });
      }
      status$.textContent = t('sheet.saved');
      status$.classList.add('sheet-status--ok');
      await loadDashboard();
      if (currentRoute() === 'gym') await renderGymView();
      closeSheet();
    } catch (e) {
      status$.textContent = t('sheet.error', { msg: e.message });
      status$.classList.add('sheet-status--err');
    }
  });

  openSheet(t(isEdit ? 'sheet.gym.title.edit' : 'sheet.gym.title.new'), tpl);
}

/* ---------- Action wiring ---------- */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'plan-cardio') openCardioSheet(t.dataset.kind || null);
  else if (action === 'start-gym') openGymSheet(null);
});

/* ---------- Profile form ---------- */

$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const localeSel = f.elements['locale'];
  const payload = {
    goal: f.elements['goal'].value,
    fitnessLevel: f.elements['fitnessLevel'].value,
    weeklyMinutes: parseInt(f.elements['weeklyMinutes'].value, 10) || 0,
    timezone: f.elements['timezone'].value.trim() || 'UTC',
    displayName: f.elements['displayName'].value.trim() || null,
    ...(localeSel ? { locale: localeSel.value } : {}),
  };
  const status = $('#profile-status');
  status.textContent = t('sheet.saving');
  try {
    const updated = await api('/api/me/profile', { method: 'PUT', body: JSON.stringify(payload) });
    renderProfile(updated);
    // Apply the (possibly new) locale immediately — re-renders static DOM and
    // the dashboard pieces below get the new wording on their next paint.
    if (updated.locale && updated.locale !== window.i18n.currentLocale()) {
      window.i18n.setLocale(updated.locale);
    }
    status.textContent = t('me.saved');
    await loadDashboard();
  } catch (err) {
    status.textContent = t('sheet.error', { msg: err.message });
  }
});

$('#profile-reset').addEventListener('click', async () => {
  if (!confirm(t('me.resetConfirm'))) return;
  const status = $('#profile-status');
  status.textContent = t('me.resetting');
  try {
    const p = await api('/api/me/profile/reset', { method: 'POST' });
    renderProfile(p);
    status.textContent = t('me.reset');
    await loadDashboard();
  } catch (err) {
    status.textContent = t('sheet.error', { msg: err.message });
  }
});

/* ---------- Data wipe ---------- */

$('#reset-button').addEventListener('click', async () => {
  const phrase = prompt(t('me.deletePrompt'));
  if (phrase !== 'DELETE') return;
  const status = $('#reset-status');
  status.textContent = t('me.deleting');
  try {
    const r = await fetch('/api/me/workouts', { method: 'DELETE', headers: { 'X-Confirm-Delete-All': 'yes' } });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: 'failed' }));
      throw new Error(err.error || 'failed');
    }
    const out = await r.json();
    status.textContent = t('me.deleted', { n: out.deleted });
    await loadDashboard();
    if (currentRoute() === 'cardio') renderCardioView();
    if (currentRoute() === 'gym') renderGymView();
  } catch (err) {
    status.textContent = t('sheet.error', { msg: err.message });
  }
});

/* ---------- Footer version ---------- */

async function loadVersion() {
  try {
    const v = await api('/api/version');
    const footer = $('#page-footer');
    if (!footer) return;
    const sha = (v.sha && v.sha !== 'unknown') ? v.sha.slice(0, 7) : '';
    const tag = v.semver || v.version || 'dev';
    footer.textContent = `pt ${tag}${sha ? ' · ' + sha : ''}`;
    footer.title = `Built ${v.builtAt || 'unknown'} · branch ${v.branch || 'unknown'} · uptime ${v.uptimeSeconds}s`;
  } catch { /* silent */ }
}

/* ---------- escape ---------- */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* ---------- bootstrap ---------- */

(async () => {
  // Initial locale from browser only — once the profile loads, we'll switch
  // again if the user has a saved preference. Doing it in two steps means the
  // first paint is in a plausible language instead of always English.
  window.i18n.setLocale(window.i18n.pickInitialLocale(null));

  const me = await loadMe();
  if (!me) return;
  showView(currentRoute());
  await loadDashboard();
  // If the loaded profile carries a preferred locale that differs from the
  // browser default, switch now (re-runs applyDom across all static text).
  const saved = state.profile && state.profile.locale;
  if (saved && saved !== window.i18n.currentLocale()) {
    window.i18n.setLocale(saved);
    // Re-render dynamic pieces that don't carry data-i18n.
    if (state.dashboard) {
      renderHero(state.dashboard.summary, state.dashboard.lifetime);
    }
  }
  loadVersion();
})();
