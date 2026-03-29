(function nutritionDashboard() {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  CSS                                                                */
  /* ------------------------------------------------------------------ */
  var STYLE = [
    '.nd-root {',
    '  font-family: var(--font-family, system-ui, sans-serif);',
    '  color: var(--text);',
    '  padding: 1.5rem;',
    '  max-width: 64rem;',
    '  margin: 0 auto;',
    '}',

    '/* --- Loading skeleton --- */',
    '.nd-skeleton {',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 1rem;',
    '}',
    '.nd-skeleton-header {',
    '  height: 2rem;',
    '  width: 40%;',
    '  border-radius: 0.25rem;',
    '  background: var(--surface);',
    '  animation: nd-pulse 1.5s ease-in-out infinite;',
    '}',
    '.nd-skeleton-row {',
    '  display: flex;',
    '  gap: 1rem;',
    '}',
    '.nd-skeleton-card {',
    '  flex: 1;',
    '  height: 6rem;',
    '  border-radius: 0.5rem;',
    '  background: var(--surface);',
    '  animation: nd-pulse 1.5s ease-in-out infinite;',
    '}',
    '.nd-skeleton-card:nth-child(2) { animation-delay: 0.15s; }',
    '.nd-skeleton-card:nth-child(3) { animation-delay: 0.3s; }',
    '.nd-skeleton-table {',
    '  height: 12rem;',
    '  border-radius: 0.5rem;',
    '  background: var(--surface);',
    '  animation: nd-pulse 1.5s ease-in-out infinite;',
    '  animation-delay: 0.45s;',
    '}',
    '@keyframes nd-pulse {',
    '  0%, 100% { filter: brightness(0.6); }',
    '  50%      { filter: brightness(1); }',
    '}',

    '/* --- Empty state --- */',
    '.nd-empty {',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 4rem 1rem;',
    '  text-align: center;',
    '  border: 1px dashed var(--border);',
    '  border-radius: 0.5rem;',
    '  margin-top: 1.5rem;',
    '}',
    '.nd-empty-icon {',
    '  font-size: 3rem;',
    '  line-height: 1;',
    '  margin-bottom: 1rem;',
    '  color: var(--text-dim);',
    '}',
    '.nd-empty-title {',
    '  font-size: 1.25rem;',
    '  font-weight: 600;',
    '  margin: 0 0 0.5rem;',
    '  color: var(--text);',
    '}',
    '.nd-empty-subtitle {',
    '  font-size: 0.875rem;',
    '  color: var(--text-dim);',
    '  margin: 0 0 1.5rem;',
    '  max-width: 28rem;',
    '}',
    '.nd-empty-action {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.375rem;',
    '  padding: 0.5rem 1.25rem;',
    '  font-size: 0.875rem;',
    '  font-weight: 500;',
    '  color: var(--text);',
    '  background: var(--accent);',
    '  border: none;',
    '  border-radius: 0.375rem;',
    '  cursor: pointer;',
    '  transition: background 0.15s ease;',
    '}',
    '.nd-empty-action:hover,',
    '.nd-empty-action:focus-visible {',
    '  filter: brightness(1.15);',
    '  outline: none;',
    '}',
    '.nd-empty-action:focus-visible {',
    '  box-shadow: 0 0 0 0.125rem var(--accent);',
    '}',

    '/* --- Dashboard header --- */',
    '.nd-header {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  margin-bottom: 1.5rem;',
    '}',
    '.nd-title {',
    '  font-size: 1.5rem;',
    '  font-weight: 700;',
    '  margin: 0;',
    '  color: var(--text);',
    '}',
    '.nd-date {',
    '  font-size: 0.75rem;',
    '  color: var(--text-dim);',
    '}',

    '/* --- Summary cards --- */',
    '.nd-summary {',
    '  display: flex;',
    '  gap: 1rem;',
    '  margin-bottom: 1.5rem;',
    '  flex-wrap: wrap;',
    '}',
    '.nd-card {',
    '  flex: 1 1 10rem;',
    '  background: var(--surface);',
    '  border: 1px solid var(--border);',
    '  border-radius: 0.5rem;',
    '  padding: 1rem;',
    '  min-width: 0;',
    '}',
    '.nd-card-label {',
    '  font-size: 0.75rem;',
    '  color: var(--text-dim);',
    '  margin: 0 0 0.25rem;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.04em;',
    '}',
    '.nd-card-value {',
    '  font-size: 1.5rem;',
    '  font-weight: 700;',
    '  margin: 0;',
    '  color: var(--text);',
    '}',
    '.nd-card-unit {',
    '  font-size: 0.75rem;',
    '  font-weight: 400;',
    '  color: var(--text-dim);',
    '}',

    '/* --- Meal log table --- */',
    '.nd-table-wrap {',
    '  overflow-x: auto;',
    '}',
    '.nd-table {',
    '  width: 100%;',
    '  border-collapse: collapse;',
    '  font-size: 0.875rem;',
    '}',
    '.nd-table th {',
    '  text-align: left;',
    '  padding: 0.5rem 0.75rem;',
    '  font-weight: 600;',
    '  font-size: 0.75rem;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.04em;',
    '  color: var(--text-dim);',
    '  border-bottom: 1px solid var(--border);',
    '}',
    '.nd-table td {',
    '  padding: 0.5rem 0.75rem;',
    '  border-bottom: 1px solid var(--border);',
    '  color: var(--text);',
    '}',
    '.nd-table tr:last-child td {',
    '  border-bottom: none;',
    '}',

    '/* --- Refresh button --- */',
    '.nd-refresh {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.375rem;',
    '  padding: 0.375rem 0.75rem;',
    '  font-size: 0.75rem;',
    '  font-weight: 500;',
    '  color: var(--text);',
    '  background: var(--surface);',
    '  border: 1px solid var(--border);',
    '  border-radius: 0.375rem;',
    '  cursor: pointer;',
    '  transition: background 0.15s ease;',
    '}',
    '.nd-refresh:hover,',
    '.nd-refresh:focus-visible {',
    '  filter: brightness(1.15);',
    '  outline: none;',
    '}',
    '.nd-refresh:focus-visible {',
    '  box-shadow: 0 0 0 0.125rem var(--accent);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /*  Templates                                                          */
  /* ------------------------------------------------------------------ */

  function renderSkeleton() {
    return '<div class="nd-skeleton" data-testid="nd-skeleton-container" role="status" aria-label="Loading nutrition data">'
      + '<div class="nd-skeleton-header"></div>'
      + '<div class="nd-skeleton-row">'
      + '<div class="nd-skeleton-card"></div>'
      + '<div class="nd-skeleton-card"></div>'
      + '<div class="nd-skeleton-card"></div>'
      + '</div>'
      + '<div class="nd-skeleton-table"></div>'
      + '<span style="position:absolute;width:0.0625rem;height:0.0625rem;overflow:hidden;clip:rect(0,0,0,0)">Loading...</span>'
      + '</div>';
  }

  function renderEmpty() {
    return '<div class="nd-empty" data-testid="nd-empty-container">'
      + '<div class="nd-empty-icon" aria-hidden="true">'
      + '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M3 3h18v18H3z"/><path d="M8 12h8"/><path d="M12 8v8"/>'
      + '</svg>'
      + '</div>'
      + '<p class="nd-empty-title">No nutrition data yet</p>'
      + '<p class="nd-empty-subtitle">Start logging meals to see your daily nutrition summary, macro breakdown, and meal history here.</p>'
      + '<button class="nd-empty-action" data-action="log-meal" data-testid="nd-button-logMeal" type="button">+ Log your first meal</button>'
      + '</div>';
  }

  function renderDashboard(ctx, data) {
    var esc = ctx.escapeHtml;
    var totals = data.totals || {};
    var meals = data.meals || [];

    var mealRows = '';
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      mealRows += '<tr>'
        + '<td>' + esc(String(m.name || '')) + '</td>'
        + '<td>' + esc(String(m.calories || 0)) + '</td>'
        + '<td>' + esc(String(m.protein || 0)) + '</td>'
        + '<td>' + esc(String(m.carbs || 0)) + '</td>'
        + '<td>' + esc(String(m.fat || 0)) + '</td>'
        + '<td>' + esc(String(m.time || '')) + '</td>'
        + '</tr>';
    }

    return '<div class="nd-header">'
      + '<h2 class="nd-title">Nutrition Dashboard</h2>'
      + '<div>'
      + '<span class="nd-date" data-testid="nd-text-date">' + esc(String(data.date || '')) + '</span> '
      + '<button class="nd-refresh" data-action="refresh" data-testid="nd-button-refresh" type="button" aria-label="Refresh nutrition data">Refresh</button>'
      + '</div>'
      + '</div>'
      + '<div class="nd-summary" data-testid="nd-summary-container">'
      + '<div class="nd-card" data-testid="nd-card-calories"><p class="nd-card-label">Calories</p><p class="nd-card-value">' + esc(String(totals.calories || 0)) + ' <span class="nd-card-unit">kcal</span></p></div>'
      + '<div class="nd-card" data-testid="nd-card-protein"><p class="nd-card-label">Protein</p><p class="nd-card-value">' + esc(String(totals.protein || 0)) + ' <span class="nd-card-unit">g</span></p></div>'
      + '<div class="nd-card" data-testid="nd-card-carbs"><p class="nd-card-label">Carbs</p><p class="nd-card-value">' + esc(String(totals.carbs || 0)) + ' <span class="nd-card-unit">g</span></p></div>'
      + '<div class="nd-card" data-testid="nd-card-fat"><p class="nd-card-label">Fat</p><p class="nd-card-value">' + esc(String(totals.fat || 0)) + ' <span class="nd-card-unit">g</span></p></div>'
      + '</div>'
      + '<div class="nd-table-wrap" data-testid="nd-table-meals">'
      + '<table class="nd-table"><thead><tr>'
      + '<th>Meal</th><th>Calories</th><th>Protein (g)</th><th>Carbs (g)</th><th>Fat (g)</th><th>Time</th>'
      + '</tr></thead>'
      + '<tbody>' + (mealRows || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">No meals logged today</td></tr>') + '</tbody>'
      + '</table></div>';
  }

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  var state = 'loading';
  var dashboardData = null;
  var lastHash = '';
  var pollTimer = null;
  var delegationHandler = null;
  var keydownHandler = null;

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */
  function renderAll(ctx, container) {
    var html;
    if (state === 'loading') {
      html = renderSkeleton();
    } else if (state === 'empty') {
      html = renderEmpty();
    } else {
      html = renderDashboard(ctx, dashboardData);
    }

    var hash = state + ':' + JSON.stringify(dashboardData);
    if (hash === lastHash) return;
    lastHash = hash;

    ctx.patchHtml(container, html);
  }

  /* ------------------------------------------------------------------ */
  /*  Data fetching                                                      */
  /* ------------------------------------------------------------------ */
  function fetchData(ctx, container) {
    state = 'loading';
    renderAll(ctx, container);

    ctx.apiFetch('/api/nutrition/today')
      .then(function (res) {
        if (!res.ok) throw new Error('API responded ' + res.status);
        return res.json();
      })
      .then(function (body) {
        var payload = body.data || body;
        var meals = payload.meals || [];
        if (meals.length === 0 && !payload.totals) {
          state = 'empty';
          dashboardData = null;
        } else {
          state = 'ready';
          dashboardData = payload;
        }
        renderAll(ctx, container);
      })
      .catch(function (err) {
        ctx.logger.error({ err: err }, 'nutrition-dashboard: fetch failed');
        state = 'empty';
        dashboardData = null;
        renderAll(ctx, container);
      });
  }

  /* ------------------------------------------------------------------ */
  /*  MFE lifecycle                                                      */
  /* ------------------------------------------------------------------ */
  return {
    init: function init(ctx, container) {
      if (!document.getElementById('nd-styles')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'nd-styles';
        styleEl.textContent = STYLE;
        document.head.appendChild(styleEl);
      }

      container.classList.add('nd-root');
      container.innerHTML = renderSkeleton();

      delegationHandler = function (e) {
        var target = e.target.closest('[data-action]');
        if (!target) return;
        var action = target.getAttribute('data-action');
        if (action === 'refresh') {
          fetchData(ctx, container);
        } else if (action === 'log-meal') {
          ctx.navigate('/meals/new');
        }
      };
      container.addEventListener('click', delegationHandler);

      keydownHandler = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          var target = e.target.closest('[data-action]');
          if (target && target.tagName !== 'BUTTON') {
            e.preventDefault();
            target.click();
          }
        }
      };
      container.addEventListener('keydown', keydownHandler);
    },

    activate: function activate(ctx, container) {
      fetchData(ctx, container);
      pollTimer = setInterval(function () {
        fetchData(ctx, container);
      }, 60000);
    },

    deactivate: function deactivate(ctx, container) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (delegationHandler) {
        container.removeEventListener('click', delegationHandler);
        delegationHandler = null;
      }
      if (keydownHandler) {
        container.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
      }
      lastHash = '';
    }
  };
})();
