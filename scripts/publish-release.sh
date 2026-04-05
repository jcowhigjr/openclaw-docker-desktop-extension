#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
dry_run="${DRY_RUN:-0}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make publish-release RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required to publish a release." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh auth status failed. Log in with 'gh auth login' before publishing a release." >&2
  exit 1
fi

if ! gh api "/repos/${repo_owner}/${repo_name}/git/ref/tags/${release_tag}" >/dev/null 2>&1; then
  echo "git tag is missing: ${release_tag}" >&2
  echo "Next step: create and push the tag before publishing a GitHub release." >&2
  exit 1
fi

if gh api "/repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}" >/dev/null 2>&1; then
  echo "GitHub release already exists: ${release_tag}"
  echo "Next step: run make verify-release-tag RELEASE_TAG=${release_tag}" >&2
  exit 0
fi

release_args="release create ${release_tag} --repo ${repo_owner}/${repo_name} --title ${release_tag} --generate-notes"

if [ "$dry_run" = "1" ]; then
  echo "dry run: gh ${release_args}"
  exit 0
fi

gh release create "${release_tag}" \
  --repo "${repo_owner}/${repo_name}" \
  --title "${release_tag}" \
  --generate-notes

cat <<EOF
GitHub release published: ${release_tag}
Next step: make verify-release-tag RELEASE_TAG=${release_tag}
EOF
