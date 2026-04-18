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

assert_case() {
  description="$1"
  target="$2"
  expected_command="$3"

  output="$(make "$target" RELEASE_TAG=v1.2.3 DRY_RUN=1 2>&1)"
  assert_contains "$output" "dry run: docker manifest inspect ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3"
  assert_contains "$output" "$expected_command"
  echo "passed: ${description}"
}

assert_case \
  "install-release dry run prints install command" \
  "install-release" \
  "dry run: docker extension install -f ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3"

assert_case \
  "update-release dry run prints update command" \
  "update-release" \
  "dry run: docker extension update ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3"

echo "release install dry-run checks passed"
