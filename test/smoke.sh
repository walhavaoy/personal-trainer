#!/usr/bin/env bash
#
# pt smoke test — exercises the deployed pt service end-to-end via
# `kubectl exec` against the running pod. No new deps, no Postgres
# stand-up, no port-forwarding — relies on the cluster's loopback.
#
# Run:
#   pt/test/smoke.sh                   # default namespace project-pt
#   NAMESPACE=project-pt pt/test/smoke.sh
#
# Exits non-zero if any assertion fails.

set -u

NAMESPACE="${NAMESPACE:-project-pt}"
TEST_USER="smoke-$$-$RANDOM"
OTHER_USER="other-$$-$RANDOM"

PASS=0
FAIL=0
FAILED_CASES=()

# Run a node IIFE inside the pt pod that makes an HTTP request and prints
# "STATUS<TAB>BODY". Caller parses out what it needs.
remote() {
  local user="$1" method="$2" path="$3" body="${4:-}" extra_headers="${5:-}"
  kubectl -n "$NAMESPACE" exec deploy/pt -- node -e "
    const h=require('http');
    const headers = {
      'x-forwarded-user': '$user',
      'x-forwarded-name': '$user demo',
      'x-forwarded-email': '$user@example.com',
      'content-type': 'application/json',
      $extra_headers
    };
    const opts = {host:'127.0.0.1', port:8080, path:'$path', method:'$method', headers};
    const req = h.request(opts, r => {
      let d=''; r.on('data', c => d += c);
      r.on('end', () => { process.stdout.write(r.statusCode + '\t' + d); });
    });
    req.on('error', e => { process.stdout.write('0\t' + JSON.stringify({error: e.message})); });
    $( [ -n "$body" ] && echo "req.write(JSON.stringify($body));" )
    req.end();
  " 2>/dev/null
}

assert() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf '  \033[32m✔\033[0m %s\n' "$label"
  else
    FAIL=$((FAIL + 1))
    FAILED_CASES+=("$label")
    printf '  \033[31m✘\033[0m %s\n    expected: %s\n    actual:   %s\n' "$label" "$expected" "$actual"
  fi
}

status_of() { echo "$1" | cut -f1; }
body_of() { echo "$1" | cut -f2-; }
field()    { echo "$2" | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{try{const o=JSON.parse(d);process.stdout.write(String(o$1 ?? ''))}catch{process.stdout.write('')}})"; }

section() { printf '\n\033[36m== %s ==\033[0m\n' "$1"; }

# ── Identity ────────────────────────────────────────────────────────────────
section "identity + profile defaults"
r=$(remote "$TEST_USER" GET /api/me)
assert "GET /api/me returns 200"               200       "$(status_of "$r")"
assert "GET /api/me echoes the username"       "$TEST_USER" "$(field ".username" "$(body_of "$r")")"

r=$(remote "$TEST_USER" GET /api/me/profile)
assert "GET /api/me/profile auto-creates row"  200       "$(status_of "$r")"
assert "default goal is general_fitness"       general_fitness "$(field ".goal" "$(body_of "$r")")"
assert "default fitnessLevel is beginner"      beginner  "$(field ".fitnessLevel" "$(body_of "$r")")"
assert "default weeklyMinutes is 150"          150       "$(field ".weeklyMinutes" "$(body_of "$r")")"

# ── Profile update ──────────────────────────────────────────────────────────
section "profile validation"
r=$(remote "$TEST_USER" PUT /api/me/profile '{goal:"strength",fitnessLevel:"intermediate",weeklyMinutes:240}')
assert "PUT /api/me/profile valid → 200"       200       "$(status_of "$r")"
assert "weeklyMinutes updated to 240"          240       "$(field ".weeklyMinutes" "$(body_of "$r")")"

r=$(remote "$TEST_USER" PUT /api/me/profile '{goal:"not_a_goal"}')
assert "bad goal → 400"                        400       "$(status_of "$r")"

r=$(remote "$TEST_USER" PUT /api/me/profile '{weeklyMinutes:99999}')
assert "weeklyMinutes out of range → 400"      400       "$(status_of "$r")"

r=$(remote "$TEST_USER" PUT /api/me/profile '{timezone:"Not/Real"}')
assert "bad timezone → 400"                    400       "$(status_of "$r")"

# ── Today's session ─────────────────────────────────────────────────────────
section "today's session"
r=$(remote "$TEST_USER" GET /api/me/today)
assert "GET /api/me/today returns 200"         200       "$(status_of "$r")"
THEME=$(field ".theme" "$(body_of "$r")")
[ -n "$THEME" ] && PASS=$((PASS + 1)) && printf '  \033[32m✔\033[0m today has a theme: %s\n' "$THEME" || { FAIL=$((FAIL+1)); printf '  \033[31m✘\033[0m today has no theme\n'; }

# ── Workout log ─────────────────────────────────────────────────────────────
section "workout log + multi-user isolation"
r=$(remote "$TEST_USER" POST /api/me/workouts '{completedMinutes: 30, notes: "smoke test"}')
assert "POST /api/me/workouts → 201"           201       "$(status_of "$r")"
WORKOUT_ID=$(field ".id" "$(body_of "$r")")

r=$(remote "$TEST_USER" POST /api/me/workouts '{completedMinutes: -5}')
assert "negative minutes → 400"                400       "$(status_of "$r")"

r=$(remote "$TEST_USER" GET /api/me/workouts)
COUNT=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "history has the new workout"           1         "$COUNT"

# Cross-user isolation: $OTHER_USER cannot edit $TEST_USER's workout.
r=$(remote "$OTHER_USER" PATCH "/api/me/workouts/$WORKOUT_ID" '{completedMinutes: 99}')
assert "cross-user PATCH → 404"                404       "$(status_of "$r")"

r=$(remote "$OTHER_USER" DELETE "/api/me/workouts/$WORKOUT_ID")
assert "cross-user DELETE → 404"               404       "$(status_of "$r")"

# Confirm OUR row is unchanged.
r=$(remote "$TEST_USER" GET /api/me/workouts)
COMPLETED=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d)[0].completedMinutes))}catch{process.stdout.write('?')}})")
assert "our minutes still 30 after cross-user attempt" 30 "$COMPLETED"

# Patch our own row.
r=$(remote "$TEST_USER" PATCH "/api/me/workouts/$WORKOUT_ID" '{completedMinutes: 35, notes: "edited"}')
assert "PATCH own workout → 200"               200       "$(status_of "$r")"
assert "minutes updated to 35"                 35        "$(field ".completedMinutes" "$(body_of "$r")")"

# ── Dashboard batch ─────────────────────────────────────────────────────────
section "dashboard batch endpoint"
r=$(remote "$TEST_USER" GET /api/me/dashboard)
assert "GET /api/me/dashboard → 200"           200       "$(status_of "$r")"
KEYS=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(Object.keys(JSON.parse(d)).sort().join(','))}catch{process.stdout.write('')}})")
assert "dashboard keys are correct"            "preview,profile,summary,today,trend,workouts" "$KEYS"

# ── Bulk delete ─────────────────────────────────────────────────────────────
section "bulk delete + confirmation"
r=$(remote "$TEST_USER" DELETE /api/me/workouts)
assert "bulk delete without header → 400"      400       "$(status_of "$r")"

r=$(remote "$TEST_USER" DELETE /api/me/workouts "" "'X-Confirm-Delete-All': 'yes',")
assert "bulk delete with header → 200"         200       "$(status_of "$r")"
DELETED=$(field ".deleted" "$(body_of "$r")")
assert "deleted count is 1"                    1         "$DELETED"

# ── Cleanup: also delete OTHER_USER's profile row if it auto-created ────────
section "summary"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  printf '\n\033[32mAll %d assertions passed.\033[0m\n' "$TOTAL"
  exit 0
else
  printf '\n\033[31m%d of %d assertions failed:\033[0m\n' "$FAIL" "$TOTAL"
  for c in "${FAILED_CASES[@]}"; do printf '  - %s\n' "$c"; done
  exit 1
fi
