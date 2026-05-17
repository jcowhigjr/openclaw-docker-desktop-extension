#!/bin/sh
set -eu

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

report_dir="${tmp_dir}/2026-05-17-stable-channel-smoke"
output="$(REPORT_DIR="$report_dir" REPORT_DATE="2026-05-17" RELEASE_CHANNEL="stable" RELEASE_TAG="v0.3.4" sh ./scripts/create-smoke-report.sh)"

report_file="${report_dir}/report.md"

[ "$output" = "$report_file" ]
[ -f "$report_file" ]

grep -F '# stable Channel Smoke Test - 2026-05-17' "$report_file" >/dev/null
grep -F 'Release tag under test: `v0.3.4`' "$report_file" >/dev/null
grep -F 'make verify-release-channel RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.3.4' "$report_file" >/dev/null
grep -F 'docker extension ls' "$report_file" >/dev/null
grep -F 'Control UI bootstrap from extension button' "$report_file" >/dev/null

if REPORT_DIR="$report_dir" REPORT_DATE="2026-05-17" RELEASE_CHANNEL="stable" RELEASE_TAG="v0.3.4" sh ./scripts/create-smoke-report.sh >/dev/null 2>&1; then
  echo "expected create-smoke-report to refuse overwriting an existing report" >&2
  exit 1
fi

echo "create-smoke-report checks passed"
