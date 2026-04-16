#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
dry_run="${DRY_RUN:-0}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make verify-release-tag RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: gh api /repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}
dry run: gh api /users/${ghcr_owner}/packages/container/openclaw-docker-desktop-extension/versions?per_page=100 --paginate
dry run: gh api /users/${ghcr_owner}/packages/container/openclaw-docker-desktop-extension
dry run: gh api /users/${ghcr_owner}/packages/container/openclaw-docker-desktop-extension-runtime/versions?per_page=100 --paginate
dry run: gh api /users/${ghcr_owner}/packages/container/openclaw-docker-desktop-extension-runtime
EOF
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required for release verification." >&2
  exit 1
fi

auth_status="$(gh auth status 2>&1 || true)"

if ! printf '%s\n' "$auth_status" | grep -F "Active account: true" >/dev/null 2>&1; then
  echo "gh auth status failed. Log in with 'gh auth login' before verifying a release tag." >&2
  exit 1
fi

require_auth_scope() {
  required_scope="$1"

  if printf '%s\n' "$auth_status" | grep -F "'${required_scope}'" >/dev/null 2>&1; then
    return 0
  fi

  echo "gh token is missing the required scope: ${required_scope}" >&2
  echo "Next step: run 'gh auth refresh -s ${required_scope}' and rerun make verify-release-tag RELEASE_TAG=${release_tag}." >&2
  exit 1
}

resolve_package_owner_scope() {
  package_name="$1"

  require_auth_scope "read:packages"

  for owner_scope in users orgs; do
    if gh api "/${owner_scope}/${ghcr_owner}/packages/container/${package_name}" >/dev/null 2>&1; then
      echo "$owner_scope"
      return 0
    fi
  done

  return 1
}

require_release() {
  require_auth_scope "repo"

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

require_package_tag() {
  package_name="$1"
  image_name="$2"
  owner_scope="$(resolve_package_owner_scope "$package_name" || true)"

  if [ -z "$owner_scope" ]; then
    echo "ghcr package details unavailable: ghcr.io/${ghcr_owner}/${image_name}" >&2
    echo "Next step: confirm the package exists under ${ghcr_owner} and is visible to GitHub Packages." >&2
    return 1
  fi

  if gh api "/${owner_scope}/${ghcr_owner}/packages/container/${package_name}/versions?per_page=100" \
    --paginate \
    --jq ".[] | select(any(.metadata.container.tags[]?; . == \"${release_tag}\")) | .id" \
    | grep -q '.'; then
    echo "ghcr tag exists: ghcr.io/${ghcr_owner}/${image_name}:${release_tag}"
    return 0
  fi

  echo "ghcr tag missing: ghcr.io/${ghcr_owner}/${image_name}:${release_tag}" >&2
  echo "Next step: confirm the publish workflow completed and the package is public." >&2
  return 1
}

require_package_public() {
  package_name="$1"
  image_name="$2"
  owner_scope="$(resolve_package_owner_scope "$package_name" || true)"

  if [ -z "$owner_scope" ]; then
    echo "ghcr package details unavailable: ghcr.io/${ghcr_owner}/${image_name}" >&2
    echo "Next step: confirm the package exists under ${ghcr_owner} and is visible to GitHub Packages." >&2
    return 1
  fi

  visibility="$(gh api "/${owner_scope}/${ghcr_owner}/packages/container/${package_name}" --jq '.visibility' 2>/dev/null || true)"

  if [ "$visibility" = "public" ]; then
    echo "ghcr package is public: ghcr.io/${ghcr_owner}/${image_name}"
    return 0
  fi

  if [ -z "$visibility" ]; then
    echo "ghcr package details unavailable: ghcr.io/${ghcr_owner}/${image_name}" >&2
    echo "Next step: confirm the package exists under ${ghcr_owner} and is visible to GitHub Packages." >&2
    return 1
  fi

  echo "ghcr package is not public (${visibility}): ghcr.io/${ghcr_owner}/${image_name}" >&2
  echo "Next step: change the package visibility to public so end users can install it without authentication." >&2
  return 1
}

require_release
require_package_tag "openclaw-docker-desktop-extension" "openclaw-docker-desktop-extension"
require_package_public "openclaw-docker-desktop-extension" "openclaw-docker-desktop-extension"
require_package_tag "openclaw-docker-desktop-extension-runtime" "openclaw-docker-desktop-extension-runtime"
require_package_public "openclaw-docker-desktop-extension-runtime" "openclaw-docker-desktop-extension-runtime"

cat <<EOF
Release install path is ready for this tag:
  make install-release RELEASE_TAG=${release_tag}
EOF
