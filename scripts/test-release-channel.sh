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
  release_tag="$2"
  event_name="$3"
  promote_channel="$4"
  expected_channel="$5"
  expected_flag="$6"

  output="$(./scripts/release-channel.sh "$release_tag" "$event_name" "$promote_channel")"
  assert_contains "$output" "release_tag=${release_tag}"
  assert_contains "$output" "channel_tag=${expected_channel}"
  assert_contains "$output" "has_channel_tag=${expected_flag}"
  echo "passed: ${description}"
}

assert_case "stable channel on tag push" "v1.2.3" "push" "0" "stable" "true"
assert_case "beta channel on prerelease tag push" "v1.2.3-rc.1" "push" "0" "beta" "true"
assert_case "beta channel on beta suffix tag push" "v1.2.3-beta.2" "push" "0" "beta" "true"
assert_case "stable channel on user-verified tag push" "v0.1.0-user-verified" "push" "0" "stable" "true"
assert_case "manual repair keeps version-only publish" "v1.2.3" "workflow_dispatch" "0" "" "false"
assert_case "manual prerelease repair keeps version-only publish" "v1.2.3-rc.1" "workflow_dispatch" "0" "" "false"
assert_case "manual repair can promote stable channel" "v1.2.3" "workflow_dispatch" "1" "stable" "true"
assert_case "manual repair can promote beta channel" "v1.2.3-rc.1" "workflow_dispatch" "1" "beta" "true"

echo "release-channel checks passed"
