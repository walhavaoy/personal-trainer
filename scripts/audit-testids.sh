#!/usr/bin/env bash
# audit-testids.sh — Scan tmpclaw components for interactive HTML elements
# missing data-testid attributes.
#
# Usage:  ./scripts/audit-testids.sh [component ...]
#         With no arguments, scans all component src/ directories.
#
# Exit codes:
#   0  All interactive elements have data-testid (or no elements found)
#   1  One or more interactive elements are missing data-testid

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Components to scan — each must have a src/ directory
ALL_COMPONENTS=(portal admin agent taskmaster builder operator orchestrator)

if [ $# -gt 0 ]; then
  COMPONENTS=("$@")
else
  COMPONENTS=("${ALL_COMPONENTS[@]}")
fi

# Interactive HTML tags to check (opening tags)
# We look for these inside template literals (backtick strings) and
# innerHTML/patchHtml assignments.
INTERACTIVE_TAGS='<(button|input|select|textarea|a |a>|form)'
DATA_ACTION='data-action='
ROLE_INTERACTIVE='role="(button|tab|checkbox|switch)"'

MISSING=0
TOTAL_CHECKED=0
DUPLICATE_ERRORS=0

# Associative array to track testid values per component
declare -A SEEN_TESTIDS

report_missing() {
  local file="$1" line="$2" match="$3"
  echo "MISSING  ${file}:${line}  ${match}"
  MISSING=$((MISSING + 1))
}

check_duplicate() {
  local component="$1" testid="$2" file="$3" line="$4"
  local key="${component}::${testid}"
  if [ -n "${SEEN_TESTIDS[$key]:-}" ]; then
    echo "DUPLICATE  ${file}:${line}  data-testid=\"${testid}\" (first seen at ${SEEN_TESTIDS[$key]})"
    DUPLICATE_ERRORS=$((DUPLICATE_ERRORS + 1))
  else
    SEEN_TESTIDS[$key]="${file}:${line}"
  fi
}

scan_file() {
  local file="$1"
  local component="$2"
  local line_num=0

  while IFS= read -r line; do
    line_num=$((line_num + 1))

    # Check for interactive HTML tags
    if echo "$line" | grep -qEi "$INTERACTIVE_TAGS|$DATA_ACTION|$ROLE_INTERACTIVE"; then
      TOTAL_CHECKED=$((TOTAL_CHECKED + 1))

      # Extract the matched tag for reporting
      local match
      match=$(echo "$line" | grep -oEi "(<(button|input|select|textarea|a|form)[^>]*>|data-action=[^ >]*|role=\"(button|tab|checkbox|switch)\")" | head -1 || true)
      [ -z "$match" ] && match="(interactive element)"

      # Check if data-testid is on this line or the surrounding context
      if ! echo "$line" | grep -q 'data-testid='; then
        report_missing "$file" "$line_num" "$match"
      else
        # Extract testid value for duplicate checking (handles both static
        # and template-literal values)
        local testid
        testid=$(echo "$line" | grep -oP 'data-testid="[^"]*"' | head -1 | sed 's/data-testid="//;s/"$//' || true)
        if [ -n "$testid" ]; then
          # Skip template expressions — they produce dynamic values
          if ! echo "$testid" | grep -q '\$'; then
            check_duplicate "$component" "$testid" "$file" "$line_num"
          fi
        fi
      fi
    fi
  done < "$file"
}

echo "=== data-testid Audit ==="
echo ""

SCANNED_FILES=0

for component in "${COMPONENTS[@]}"; do
  src_dir="${REPO_ROOT}/${component}/src"
  if [ ! -d "$src_dir" ]; then
    echo "SKIP  ${component}/src  (directory not found)"
    continue
  fi

  echo "SCAN  ${component}/src"

  # Find TypeScript and JavaScript files
  while IFS= read -r -d '' file; do
    scan_file "$file" "$component"
    SCANNED_FILES=$((SCANNED_FILES + 1))
  done < <(find "$src_dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print0)

  # Also scan public/ui/ for MFE bundles
  bundle_dir="${REPO_ROOT}/${component}/public/ui"
  if [ -d "$bundle_dir" ]; then
    echo "SCAN  ${component}/public/ui"
    while IFS= read -r -d '' file; do
      scan_file "$file" "$component"
      SCANNED_FILES=$((SCANNED_FILES + 1))
    done < <(find "$bundle_dir" -type f \( -name '*.js' -o -name '*.ts' \) -print0)
  fi
done

echo ""
echo "=== Summary ==="
echo "Files scanned:          ${SCANNED_FILES}"
echo "Interactive elements:   ${TOTAL_CHECKED}"
echo "Missing data-testid:    ${MISSING}"
echo "Duplicate data-testid:  ${DUPLICATE_ERRORS}"
echo ""

ERRORS=$((MISSING + DUPLICATE_ERRORS))

if [ "$ERRORS" -gt 0 ]; then
  echo "FAIL  ${ERRORS} issue(s) found"
  exit 1
fi

if [ "$TOTAL_CHECKED" -eq 0 ] && [ "$SCANNED_FILES" -eq 0 ]; then
  echo "OK  No source files found — nothing to audit"
else
  echo "OK  All interactive elements have data-testid"
fi

exit 0
