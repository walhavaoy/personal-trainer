# Testing Conventions: `data-testid` Coverage

## Overview

Every interactive HTML element rendered by tmpclaw components must carry a
`data-testid` attribute. This enables reliable end-to-end and integration
testing without coupling selectors to CSS classes, DOM structure, or visible
text.

## Naming Convention

```
data-testid="{component}-{descriptor}-{element-type}"
```

| Segment | Description | Examples |
|---------|-------------|----------|
| **component** | The tmpclaw component that owns the element | `portal`, `admin`, `agent`, `taskmaster`, `builder` |
| **descriptor** | A short, kebab-cased description of what the element does | `refresh`, `status-filter`, `delete-confirm`, `search` |
| **element-type** | A suffix indicating the HTML element kind (see table below) | `-btn`, `-input`, `-link` |

### Element-type suffixes

| Suffix | HTML elements |
|--------|---------------|
| `-btn` | `<button>`, clickable `<div>` / `<span>` with `role="button"` |
| `-input` | `<input type="text">`, `<input type="number">`, `<input type="password">`, etc. |
| `-select` | `<select>` |
| `-textarea` | `<textarea>` |
| `-checkbox` | `<input type="checkbox">` |
| `-radio` | `<input type="radio">` |
| `-link` | `<a>` |
| `-form` | `<form>` |
| `-modal` | Modal container / overlay |
| `-tab` | Tab trigger element |
| `-toggle` | Toggle / switch element |

### Examples

```
data-testid="portal-nav-settings-link"
data-testid="admin-create-policy-btn"
data-testid="agent-list-refresh-btn"
data-testid="taskmaster-filter-status-select"
data-testid="taskmaster-search-input"
data-testid="builder-trigger-form"
data-testid="admin-delete-confirm-modal"
```

## Dynamic elements

For elements rendered in a loop (table rows, list items), append a unique
identifier:

```
data-testid="{component}-{descriptor}-{type}-{id}"
```

Use the item's stable identifier (database ID, name) rather than an array
index when possible. Always escape dynamic values with `ctx.escapeHtml()` to
prevent XSS when interpolating into HTML attributes.

Examples:

```
data-testid="taskmaster-task-row-${ctx.escapeHtml(task.id)}"
data-testid="agent-agent-card-${ctx.escapeHtml(agent.name)}"
```

## Scope

The following interactive elements **must** have a `data-testid`:

- `<button>`
- `<input>` (all types)
- `<select>`
- `<textarea>`
- `<a>` (links)
- `<form>`
- Any element with `data-action` attribute
- Any element with `role="button"`, `role="tab"`, `role="checkbox"`, or `role="switch"`
- Modal containers / overlays
- Tab triggers

## Enforcement

Run the audit script to check coverage:

```bash
./scripts/audit-testids.sh
```

The script scans all `src/` directories for HTML-generating code (template
literals, innerHTML assignments) and flags interactive elements that lack a
`data-testid` attribute. It exits with code 0 when all elements are covered
and code 1 when gaps are found.

## Rules

1. **No duplicates** within a single component — every `data-testid` value must
   be unique per component scope.
2. **No `id`-only selectors** — always add `data-testid` even if an `id` is
   present.  Test code should use `data-testid` exclusively.
3. **Both branches** of conditional rendering must include `data-testid` on
   their interactive elements.
4. **Escape dynamic values** — use `ctx.escapeHtml()` for any API or external
   data interpolated into `data-testid` attribute values.
5. **MFE bundles** use the bundle name as the component prefix.
