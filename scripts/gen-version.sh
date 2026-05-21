#!/bin/sh
# Generate version.json with semver + git metadata, written next to package.json.
# Usage: ./scripts/gen-version.sh
# Output: ./version.json
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

SEMVER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)
VERSION="${SEMVER}-${SHA}"

cat > version.json <<EOF
{
  "semver": "${SEMVER}",
  "version": "${VERSION}",
  "sha": "${SHA}",
  "branch": "${BRANCH}",
  "builtAt": "${BUILT_AT}",
  "component": "pt"
}
EOF

echo "version.json: ${VERSION} (${BUILT_AT})"
