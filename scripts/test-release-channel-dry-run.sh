#!/bin/sh

set -eu

assert_contains() {
  haystack="$1"
  needle="$2"

  if ! printf '%s\n' "$haystack" | grep -F "$needle" >/dev/null 2>&1; then
    echo "expected output to contain: $needle" >&2
    echo "actual output:" >&2
    printf '%s\n' "$haystack" >&2
    exit 1
  fi
}

channel_output="$(make verify-release-channel RELEASE_CHANNEL=stable DRY_RUN=1 2>&1)"
assert_contains "$channel_output" "dry run: docker manifest inspect ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable"
assert_contains "$channel_output" "dry run: docker manifest inspect ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:stable"
echo "passed: verify-release-channel dry run prints both manifest checks"

install_output="$(make verify-channel-install RELEASE_CHANNEL=stable DRY_RUN=1 2>&1)"
assert_contains "$install_output" "dry run: RELEASE_CHANNEL=stable GHCR_OWNER=jcowhigjr ./scripts/verify-release-channel.sh"
assert_contains "$install_output" "dry run: docker extension validate --validate-install-uninstall ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable"
echo "passed: verify-channel-install dry run prints validate command"

echo "release channel dry-run checks passed"
