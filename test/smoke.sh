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

# Multi-line bodies (e.g. CSV) confuse cut -f1; restrict status to the first line.
status_of() { echo "$1" | head -n1 | cut -f1; }
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

# displayName: set, fetch back, clear.
r=$(remote "$TEST_USER" PUT /api/me/profile '{displayName:"Alex"}')
assert "set displayName → 200"                 200       "$(status_of "$r")"
assert "displayName persisted"                 Alex      "$(field ".displayName" "$(body_of "$r")")"

r=$(remote "$TEST_USER" PUT /api/me/profile '{displayName:null}')
assert "clear displayName via null → 200"      200       "$(status_of "$r")"
assert "displayName now null"                  ""        "$(field ".displayName" "$(body_of "$r")")"

# Reset endpoint: after the PUT above set goal=strength/intermediate/240, reset
# should restore general_fitness/beginner/150 (tz left alone).
r=$(remote "$TEST_USER" POST /api/me/profile/reset)
assert "POST /api/me/profile/reset → 200"      200       "$(status_of "$r")"
assert "reset → goal back to general_fitness"  general_fitness "$(field ".goal" "$(body_of "$r")")"
assert "reset → fitnessLevel back to beginner" beginner  "$(field ".fitnessLevel" "$(body_of "$r")")"
assert "reset → weeklyMinutes back to 150"     150       "$(field ".weeklyMinutes" "$(body_of "$r")")"

# Restore the strength/intermediate/240 setup for downstream cases that
# depend on a real exercise prescription being available.
remote "$TEST_USER" PUT /api/me/profile '{goal:"strength",fitnessLevel:"intermediate",weeklyMinutes:240}' > /dev/null

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

# ── Per-exercise check-off validation ───────────────────────────────────────
section "exercisesCompleted validation"
# Use a fresh user so we don't conflict with WORKOUT_ID above.
EX_USER="ex-$$-$RANDOM"
r=$(remote "$EX_USER" PUT /api/me/profile '{goal:"strength",fitnessLevel:"intermediate",weeklyMinutes:240}')
assert "ex_user profile set → 200"             200       "$(status_of "$r")"

r=$(remote "$EX_USER" POST /api/me/workouts '{completedMinutes:30, exercisesCompleted:["bench press"]}')
assert "unprescribed exercise → 400"           400       "$(status_of "$r")"

r=$(remote "$EX_USER" POST /api/me/workouts '{completedMinutes:30, exercisesCompleted:"Pull-up"}')
assert "exercisesCompleted not an array → 400" 400       "$(status_of "$r")"

# Find a prescribed exercise name for today's session and POST with it.
T=$(remote "$EX_USER" GET /api/me/today)
PRESCRIBED=$(echo "$(body_of "$T")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const s=JSON.parse(d);const ex=(s.blocks||[]).flatMap(b=>(b.exercises||[]).map(e=>e.name));process.stdout.write(ex[0]||'')}catch{process.stdout.write('')}})")
if [ -n "$PRESCRIBED" ]; then
  r=$(remote "$EX_USER" POST /api/me/workouts "{completedMinutes:30, exercisesCompleted:[\"$PRESCRIBED\"]}")
  assert "valid prescribed exercise → 201"     201       "$(status_of "$r")"
fi

# ── Rest day shortcut ───────────────────────────────────────────────────────
section "rest-day shortcut"
REST_USER="rest-$$-$RANDOM"
r=$(remote "$REST_USER" POST /api/me/today/rest '{notes:"smoke"}')
assert "POST /today/rest → 201"                201       "$(status_of "$r")"
assert "theme is Rest"                         Rest      "$(field ".theme" "$(body_of "$r")")"
assert "completed is 0"                        0         "$(field ".completedMinutes" "$(body_of "$r")")"

r=$(remote "$REST_USER" POST /api/me/today/rest '{}')
assert "second rest call → 409"                409       "$(status_of "$r")"

# ── Preview / Trend / Summary / CSV ─────────────────────────────────────────
section "favicon + manifest"
r=$(remote "$TEST_USER" GET /favicon.svg)
assert "GET /favicon.svg → 200"                200       "$(status_of "$r")"
r=$(remote "$TEST_USER" GET /favicon.ico)
assert "GET /favicon.ico → 204 (silenced)"     204       "$(status_of "$r")"
r=$(remote "$TEST_USER" GET /manifest.webmanifest)
assert "GET /manifest.webmanifest → 200"       200       "$(status_of "$r")"
assert "manifest short_name is PT"             PT        "$(field ".short_name" "$(body_of "$r")")"

section "preview, trend, summary, csv"
r=$(remote "$TEST_USER" GET '/api/me/preview?days=3')
assert "GET /preview?days=3 → 200"             200       "$(status_of "$r")"
PREVIEW_LEN=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "preview returns 3 days"                3         "$PREVIEW_LEN"

r=$(remote "$TEST_USER" GET '/api/me/preview?days=0')
assert "preview days=0 → 400"                  400       "$(status_of "$r")"

r=$(remote "$TEST_USER" GET '/api/me/trend?weeks=4')
assert "GET /trend?weeks=4 → 200"              200       "$(status_of "$r")"
TREND_LEN=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "trend returns 4 weeks"                 4         "$TREND_LEN"

r=$(remote "$TEST_USER" GET /api/me/summary)
assert "GET /api/me/summary → 200"             200       "$(status_of "$r")"

r=$(remote "$TEST_USER" GET /api/me/workouts.csv)
assert "GET /workouts.csv → 200"               200       "$(status_of "$r")"
FIRST_LINE=$(echo "$(body_of "$r")" | head -1)
assert "CSV header is correct"                 "date,theme,planned_minutes,completed_minutes,exercises_completed,notes" "$FIRST_LINE"

r=$(remote "$TEST_USER" GET /api/me/lifetime)
assert "GET /api/me/lifetime → 200"            200       "$(status_of "$r")"
LIFETIME_KEYS=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(Object.keys(JSON.parse(d)).sort().join(','))}catch{process.stdout.write('')}})")
assert "lifetime keys correct"                 "distinctDaysActive,firstWorkoutDate,lastWorkoutDate,totalMinutes,totalSessions" "$LIFETIME_KEYS"
assert "lifetime.totalSessions is 1"           1         "$(field ".totalSessions" "$(body_of "$r")")"

# ── Theme filter + ?before= pagination ──────────────────────────────────────
section "history filter + pagination"
# Seed 3 backdated workouts for FILT_USER so we have multiple themes.
FILT_USER="filt-$$-$RANDOM"
r=$(remote "$FILT_USER" PUT /api/me/profile '{goal:"strength",fitnessLevel:"intermediate",weeklyMinutes:240}')
# Strength: Mon=Push, Tue=Pull, Wed=Legs. Use dates relative to today.
TODAY_ISO=$(date -u +%Y-%m-%d)
D_2_AGO=$(date -u -d '2 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-2d +%Y-%m-%d)
D_3_AGO=$(date -u -d '3 days ago' +%Y-%m-%d 2>/dev/null || date -u -v-3d +%Y-%m-%d)
remote "$FILT_USER" POST /api/me/workouts "{date:\"$D_2_AGO\", completedMinutes:30}" > /dev/null
remote "$FILT_USER" POST /api/me/workouts "{date:\"$D_3_AGO\", completedMinutes:30}" > /dev/null

r=$(remote "$FILT_USER" GET /api/me/workouts)
ALL_COUNT=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "unfiltered: 2 workouts"                2         "$ALL_COUNT"

# Pull one row to learn its theme, then filter by it — should match exactly 1.
THEME_OF_FIRST=$(remote "$FILT_USER" GET /api/me/workouts | cut -f2- | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d)[0].theme)}catch{process.stdout.write('')}})")
r=$(remote "$FILT_USER" GET "/api/me/workouts?theme=$THEME_OF_FIRST")
FILT_COUNT=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "?theme= filter returns ≥1"             1         "$FILT_COUNT"

r=$(remote "$FILT_USER" GET '/api/me/workouts?before=not-a-date')
assert "?before bad format → 400"              400       "$(status_of "$r")"

r=$(remote "$FILT_USER" GET "/api/me/workouts?before=$D_2_AGO")
OLDER_COUNT=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(String(JSON.parse(d).length))}catch{process.stdout.write('?')}})")
assert "?before= returns older only"           1         "$OLDER_COUNT"

# ── Dashboard batch ─────────────────────────────────────────────────────────
section "dashboard batch endpoint"
r=$(remote "$TEST_USER" GET /api/me/dashboard)
assert "GET /api/me/dashboard → 200"           200       "$(status_of "$r")"
KEYS=$(echo "$(body_of "$r")" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(Object.keys(JSON.parse(d)).sort().join(','))}catch{process.stdout.write('')}})")
assert "dashboard keys are correct"            "lifetime,preview,profile,summary,today,trend,workouts" "$KEYS"

# ── Bulk delete ─────────────────────────────────────────────────────────────
section "bulk delete + confirmation"
r=$(remote "$TEST_USER" DELETE /api/me/workouts)
assert "bulk delete without header → 400"      400       "$(status_of "$r")"

r=$(remote "$TEST_USER" DELETE /api/me/workouts "" "'X-Confirm-Delete-All': 'yes',")
assert "bulk delete with header → 200"         200       "$(status_of "$r")"
DELETED=$(field ".deleted" "$(body_of "$r")")
assert "deleted count is 1"                    1         "$DELETED"

# ── Cleanup test users' rows ────────────────────────────────────────────────
for u in "$EX_USER" "$REST_USER" "$FILT_USER"; do
  remote "$u" DELETE /api/me/workouts "" "'X-Confirm-Delete-All': 'yes'," > /dev/null
done

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
