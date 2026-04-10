#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
dry_run="${DRY_RUN:-0}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make ship-release RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

run_step() {
  step_label="$1"
  shift

  echo "==> ${step_label}"
  "$@"
}

run_step "Publish GitHub release if needed" \
  env RELEASE_TAG="$release_tag" REPO_OWNER="$repo_owner" REPO_NAME="$repo_name" DRY_RUN="$dry_run" \
  ./scripts/publish-release.sh

run_step "Verify GitHub release and GHCR tags" \
  env RELEASE_TAG="$release_tag" REPO_OWNER="$repo_owner" REPO_NAME="$repo_name" GHCR_OWNER="$ghcr_owner" \
  ./scripts/verify-release-tag.sh

run_step "Validate Docker Desktop install/uninstall" \
  env RELEASE_TAG="$release_tag" REPO_OWNER="$repo_owner" REPO_NAME="$repo_name" GHCR_OWNER="$ghcr_owner" DRY_RUN="$dry_run" \
  ./scripts/verify-release-install.sh

cat <<EOF
Release shipping flow completed for ${release_tag}

End-user install command:
  docker extension install ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_tag}
EOF
