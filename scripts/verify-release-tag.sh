#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_tag}"
runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_tag}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make verify-release-tag RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: gh api /repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}
dry run: docker manifest inspect ${extension_image}
dry run: docker manifest inspect ${runtime_image}
EOF
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required for release verification." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release verification." >&2
  exit 1
fi

auth_status="$(gh auth status 2>&1 || true)"

if ! printf '%s\n' "$auth_status" | grep -F "Active account: true" >/dev/null 2>&1; then
  echo "gh auth status failed. Log in with 'gh auth login' before verifying a release tag." >&2
  exit 1
fi

require_release() {
  if gh api "/repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}" >/dev/null 2>&1; then
    echo "release exists: ${release_tag}"
    return 0
  fi

  if gh api "/repos/${repo_owner}/${repo_name}/git/ref/tags/${release_tag}" >/dev/null 2>&1; then
    echo "git tag exists but GitHub release is missing: ${release_tag}" >&2
    echo "Next step: publish the GitHub release so the GHCR install path is user-visible." >&2
    return 1
  fi

  echo "git tag and GitHub release are both missing: ${release_tag}" >&2
  echo "Next step: create the tag and let the publish workflow run first." >&2
  return 1
}

require_anonymous_manifest() {
  image_ref="$1"

  if docker manifest inspect "$image_ref" >/dev/null 2>&1; then
    echo "ghcr tag is publicly readable: ${image_ref}"
    return 0
  fi

  echo "ghcr tag is missing or not publicly readable: ${image_ref}" >&2
  echo "Next step: confirm the publish workflow completed and the GHCR package is public." >&2
  return 1
}

require_release
require_anonymous_manifest "${extension_image}"
require_anonymous_manifest "${runtime_image}"

cat <<EOF
Release install path is ready for this tag:
  make install-release RELEASE_TAG=${release_tag}
EOF
