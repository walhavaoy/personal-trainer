#!/bin/sh
# Build, push, and deploy pt to a Kubernetes cluster via Helm.
#
# Defaults assume the local k3s setup:
#   - Registry exposed at localhost:31500 (k3s NodePort)
#   - kubectl + helm pointed at the right cluster
#
# Overrides via env:
#   REGISTRY        — image registry host:port (default localhost:31500)
#   IMAGE_REPO      — image name (default personal-trainer/pt)
#   RELEASE_NAME    — helm release name (default pt)
#   HELM_NAMESPACE  — helm release namespace (default project-pt)
#                     The chart still creates+manages the same namespace by default.
#   TAG             — image tag (default Unix timestamp)
#   VALUES_FILE     — extra helm values file to merge
#
# Why timestamps for tags: :latest is silently cached by containerd; unique
# tags force the pull every time.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

REGISTRY="${REGISTRY:-localhost:31500}"
IMAGE_REPO="${IMAGE_REPO:-personal-trainer/pt}"
RELEASE_NAME="${RELEASE_NAME:-pt}"
HELM_NAMESPACE="${HELM_NAMESPACE:-project-pt}"
TAG="${TAG:-$(date +%s)}"
IMAGE="${REGISTRY}/${IMAGE_REPO}:${TAG}"

# ── 1. Generate version.json ────────────────────────────────────────────────
./scripts/gen-version.sh
SEMVER=$(sed -n 's/.*"semver"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' version.json | head -1)
SHA=$(sed -n    's/.*"sha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'    version.json | head -1)
BRANCH=$(sed -n 's/.*"branch"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' version.json | head -1)

# ── 2. Docker build ─────────────────────────────────────────────────────────
echo ">> Building $IMAGE …"
docker build \
  --build-arg APP_VERSION="$SEMVER" \
  --build-arg APP_SHA="$SHA" \
  --build-arg APP_BRANCH="$BRANCH" \
  -t "$IMAGE" \
  -f Dockerfile \
  .

# ── 3. Push ─────────────────────────────────────────────────────────────────
echo ">> Pushing $IMAGE …"
docker push "$IMAGE"

# ── 4. Helm upgrade ─────────────────────────────────────────────────────────
echo ">> Helm upgrade $RELEASE_NAME …"
EXTRA_VALUES=""
if [ -n "$VALUES_FILE" ] && [ -f "$VALUES_FILE" ]; then
  EXTRA_VALUES="-f $VALUES_FILE"
fi

# shellcheck disable=SC2086
helm upgrade --install "$RELEASE_NAME" "$REPO_ROOT/chart" \
  --namespace "$HELM_NAMESPACE" \
  --create-namespace \
  --set "image.repository=${REGISTRY}/${IMAGE_REPO}" \
  --set "image.tag=${TAG}" \
  $EXTRA_VALUES \
  --wait \
  --timeout 5m

# ── 5. Sync values.yaml with deployed tag ───────────────────────────────────
# Keeps the committed values file in lock-step with what's running, the same
# pattern tmpclaw used (sed-based; portable, no yq dependency).
sed -i.bak \
  -e "s|^\(  repository:\).*|\1 ${REGISTRY}/${IMAGE_REPO}|" \
  -e "s|^\(  tag:\).*|\1 \"${TAG}\"|" \
  chart/values.yaml
rm -f chart/values.yaml.bak
echo ">> Updated chart/values.yaml image.tag to ${TAG}"

echo
echo "Deployed pt @ ${IMAGE} to ${HELM_NAMESPACE}/${RELEASE_NAME}"
