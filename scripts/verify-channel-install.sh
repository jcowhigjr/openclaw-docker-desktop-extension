#!/bin/sh

set -eu

release_channel="${1:-${RELEASE_CHANNEL:-stable}}"
ghcr_owner="${GHCR_OWNER:-jcowhigjr}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_channel}"

if [ -z "$release_channel" ]; then
  echo "RELEASE_CHANNEL is required, for example: make verify-channel-install RELEASE_CHANNEL=stable" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for channel-install verification." >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  echo "dry run: RELEASE_CHANNEL=${release_channel} GHCR_OWNER=${ghcr_owner} ./scripts/verify-release-channel.sh"
  echo "dry run: docker extension validate --validate-install-uninstall ${extension_image}"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop must be running before verifying a channel install." >&2
  echo "Next step: start Docker Desktop and confirm Docker extensions are enabled." >&2
  exit 1
fi

RELEASE_CHANNEL="$release_channel" \
  GHCR_OWNER="$ghcr_owner" \
  ./scripts/verify-release-channel.sh

docker extension validate --validate-install-uninstall "$extension_image"

cat <<EOF
Release channel install validation passed for this image:
  ${extension_image}

End-user install command:
  docker extension install ${extension_image}
EOF
