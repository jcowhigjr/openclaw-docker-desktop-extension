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

output="$(make verify-release-tag RELEASE_TAG=v1.2.3 DRY_RUN=1 2>&1)"
assert_contains "$output" "dry run: gh api /repos/jcowhigjr/openclaw-docker-desktop-extension/releases/tags/v1.2.3"
assert_contains "$output" "dry run: docker manifest inspect ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3"
assert_contains "$output" "dry run: docker manifest inspect ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:v1.2.3"

echo "release tag dry-run checks passed"
