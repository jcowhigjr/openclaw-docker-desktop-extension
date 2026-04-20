#!/bin/sh

set -eu

release_channel="${1:-${RELEASE_CHANNEL:-stable}}"
ghcr_owner="${GHCR_OWNER:-jcowhigjr}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_channel}"
runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_channel}"

if [ -z "$release_channel" ]; then
  echo "RELEASE_CHANNEL is required, for example: make verify-release-channel RELEASE_CHANNEL=stable" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: docker manifest inspect ${extension_image}
dry run: docker manifest inspect ${runtime_image}
EOF
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release-channel verification." >&2
  exit 1
fi

require_anonymous_manifest() {
  image_ref="$1"

  if docker manifest inspect "$image_ref" >/dev/null 2>&1; then
    echo "ghcr channel is publicly readable: ${image_ref}"
    return 0
  fi

  echo "ghcr channel is missing or not publicly readable: ${image_ref}" >&2
  case "$release_channel" in
    stable)
      echo "Next step: publish or repair a normal release tag so the publish workflow moves the stable channel." >&2
      ;;
    beta)
      echo "Next step: publish or repair a prerelease tag so the publish workflow moves the beta channel." >&2
      ;;
    *)
      echo "Next step: confirm the publish workflow completed and that this channel tag is expected to exist." >&2
      ;;
  esac
  return 1
}

require_anonymous_manifest "${extension_image}"
require_anonymous_manifest "${runtime_image}"

cat <<EOF
Release channel path is ready for this channel:
  make install-channel RELEASE_CHANNEL=${release_channel}
EOF
