#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_tag}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make verify-release-install RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release-install verification." >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  echo "dry run: RELEASE_TAG=${release_tag} REPO_OWNER=${repo_owner} REPO_NAME=${repo_name} GHCR_OWNER=${ghcr_owner} ./scripts/verify-release-tag.sh"
  echo "dry run: docker extension validate --validate-install-uninstall ${extension_image}"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop must be running before verifying a release install." >&2
  echo "Next step: start Docker Desktop and confirm Docker extensions are enabled." >&2
  exit 1
fi

RELEASE_TAG="$release_tag" \
  REPO_OWNER="$repo_owner" \
  REPO_NAME="$repo_name" \
  GHCR_OWNER="$ghcr_owner" \
  ./scripts/verify-release-tag.sh

docker extension validate --validate-install-uninstall "$extension_image"

cat <<EOF
Release install validation passed for this image:
  ${extension_image}

End-user install command:
  docker extension install ${extension_image}
EOF
