#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
ghcr_owner="${GHCR_OWNER:-jcowhigjr}"
image_name="${IMAGE_NAME:-openclaw-docker-desktop-extension}"
image_ref="ghcr.io/${ghcr_owner}/${image_name}:${release_tag}"
dry_run="${DRY_RUN:-0}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make install-release RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  echo "dry run: docker manifest inspect ${image_ref}" >&2
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required to verify the published extension image." >&2
  exit 1
fi

if docker manifest inspect "$image_ref" >/dev/null 2>&1; then
  cat <<EOF
Published extension image is available:
  ${image_ref}
EOF
  exit 0
fi

cat <<EOF >&2
Published extension image is not available yet:
  ${image_ref}

Next step:
  - If you are testing before the first public tag, use 'make install-dev'.
  - If this tag should exist, run 'make verify-release-tag RELEASE_TAG=${release_tag}' as a maintainer.
EOF
exit 1
