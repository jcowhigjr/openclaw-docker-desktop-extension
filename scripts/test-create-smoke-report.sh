#!/bin/sh
set -eu

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

report_dir="${tmp_dir}/2026-05-17-stable-channel-smoke"
output="$(REPORT_DIR="$report_dir" REPORT_DATE="2026-05-17" RELEASE_CHANNEL="stable" RELEASE_TAG="v0.3.4" sh ./scripts/create-smoke-report.sh)"

report_file="${report_dir}/report.md"
capture_script="${report_dir}/capture-artifacts.sh"

[ "$output" = "$report_file" ]
[ -f "$report_file" ]
[ -f "$capture_script" ]

grep -F '# stable Channel Smoke Test - 2026-05-17' "$report_file" >/dev/null
grep -F 'Release tag under test: `v0.3.4`' "$report_file" >/dev/null
grep -F 'make verify-release-channel RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.3.4' "$report_file" >/dev/null
grep -F 'Open the `Shellharbor` extension.' "$report_file" >/dev/null
grep -F 'environment.txt' "$report_file" >/dev/null
grep -F 'verify-release-channel.txt' "$report_file" >/dev/null
grep -F 'verify-channel-install-dry-run.txt' "$report_file" >/dev/null
grep -F 'docker extension ls' "$report_file" >/dev/null
grep -F 'docker-extension-inspect.txt' "$report_file" >/dev/null
grep -F 'docker-image-ls.txt' "$report_file" >/dev/null
grep -F 'openclaw-service-inspect.txt' "$report_file" >/dev/null
grep -F 'Control UI bootstrap from extension button' "$report_file" >/dev/null
grep -F 'Keep gathering evidence even when one command fails.' "$capture_script" >/dev/null
grep -F 'repo_root="' "$capture_script" >/dev/null
grep -F 'release_channel="stable"' "$capture_script" >/dev/null
grep -F 'release_tag="v0.3.4"' "$capture_script" >/dev/null
grep -F 'capture_environment' "$capture_script" >/dev/null
grep -F "printf 'captured_at=%s" "$capture_script" >/dev/null
grep -F 'docker version' "$capture_script" >/dev/null
grep -F 'capture_cmd verify-release-channel.txt make -C "$repo_root" verify-release-channel RELEASE_CHANNEL="$release_channel" EXPECTED_RELEASE_TAG="$release_tag"' "$capture_script" >/dev/null
grep -F 'capture_cmd verify-channel-install-dry-run.txt make -C "$repo_root" verify-channel-install RELEASE_CHANNEL="$release_channel" EXPECTED_RELEASE_TAG="$release_tag" DRY_RUN=1' "$capture_script" >/dev/null
grep -F 'docker-extension-ls.txt' "$capture_script" >/dev/null
grep -F 'capture_cmd docker-extension-inspect.txt docker extension inspect openclaw-docker-extension' "$capture_script" >/dev/null
grep -F "capture_cmd docker-image-ls.txt docker image ls --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.CreatedSince}}\\t{{.Size}}'" "$capture_script" >/dev/null
grep -F 'capture_cmd openclaw-service-inspect.txt docker inspect openclaw-docker-extension-service' "$capture_script" >/dev/null
grep -F 'capture failed with exit' "$capture_script" >/dev/null
grep -F 'curl -fsS http://127.0.0.1:18789/healthz' "$capture_script" >/dev/null

for artifact in environment.txt verify-release-channel.txt verify-channel-install-dry-run.txt docker-extension-ls.txt docker-extension-inspect.txt docker-ps-a.txt docker-image-ls.txt openclaw-service-inspect.txt openclaw-service.log control-ui-healthz.txt; do
  [ -f "${report_dir}/${artifact}" ]
done

if REPORT_DIR="$report_dir" REPORT_DATE="2026-05-17" RELEASE_CHANNEL="stable" RELEASE_TAG="v0.3.4" sh ./scripts/create-smoke-report.sh >/dev/null 2>&1; then
  echo "expected create-smoke-report to refuse overwriting an existing report" >&2
  exit 1
fi

# Regression coverage for the emitted capture-artifacts.sh's repo_root
# resolution (2026-09-22, second regression on the same field: first the
# generator baked its own absolute path in; the portable-derivation fix that
# replaced it then broke outside a git checkout and silently picked an
# unrelated repo when run from inside one).
#
# Tested by extracting the exact resolution block (between its own markers)
# and running it in isolation -- this exercises the real generated logic
# without going anywhere near docker/make/network, so it stays deterministic
# regardless of what those commands would actually do.
resolution_harness="$(mktemp)"
{
  printf '#!/bin/sh\nset -eu\n'
  printf 'report_dir="%s"\n' "$report_dir"
  sed -n '/# BEGIN REPO_ROOT RESOLUTION/,/# END REPO_ROOT RESOLUTION/p' "$capture_script"
  printf 'printf "%%s" "$repo_root"\n'
} >"$resolution_harness"

grep -qF 'BEGIN REPO_ROOT RESOLUTION' "$resolution_harness" || {
  echo "resolution markers not found in generated capture-artifacts.sh -- extraction failed" >&2
  exit 1
}

# Case 1: outside any git checkout, no REPO_ROOT -> non-zero exit, error
# names the override rather than a raw git fatal message.
outside_dir="$(mktemp -d)"
if resolved="$(cd "$outside_dir" && sh "$resolution_harness" 2>&1)"; then
  echo "expected resolution to fail outside a git checkout without REPO_ROOT" >&2
  echo "got: $resolved" >&2
  exit 1
fi
printf '%s' "$resolved" | grep -qF 'Set REPO_ROOT explicitly' || {
  echo "expected the no-git-checkout failure to name the REPO_ROOT override" >&2
  echo "got: $resolved" >&2
  exit 1
}
rm -rf "$outside_dir"

# Case 2: outside any git checkout, WITH REPO_ROOT -> resolves to the
# override exactly, rather than failing.
outside_dir="$(mktemp -d)"
override_root="$(mktemp -d)"
resolved="$(cd "$outside_dir" && REPO_ROOT="$override_root" sh "$resolution_harness")"
[ "$resolved" = "$override_root" ] || {
  echo "expected REPO_ROOT override to be honored exactly" >&2
  echo "expected: $override_root" >&2
  echo "got:      $resolved" >&2
  exit 1
}
rm -rf "$outside_dir" "$override_root"

# Case 3: report_dir is genuinely inside THIS repo's checkout, but CWD at run
# time is inside an UNRELATED git checkout -- must resolve THIS repo (from
# report_dir, its own location), not the unrelated CWD repo. This is the
# exact "selects that unrelated repository" regression that was reported.
this_repo_root="$(git rev-parse --show-toplevel)"
# Must be a real path inside the working tree, not git-internal metadata --
# `.git` is a file (not a directory) in a worktree checkout, and even the
# real git-dir (.git/worktrees/<name>/) does not work here: git treats being
# inside its own metadata directory specially and does not resolve
# --show-toplevel from there the way it would from an ordinary subdirectory.
in_repo_dir="${this_repo_root}/docs/exploratory/.tmp-repo-root-case3-test-$$"
mkdir -p "$in_repo_dir"
in_repo_harness="$(mktemp)"
{
  printf '#!/bin/sh\nset -eu\n'
  printf 'report_dir="%s"\n' "$in_repo_dir"
  sed -n '/# BEGIN REPO_ROOT RESOLUTION/,/# END REPO_ROOT RESOLUTION/p' "$capture_script"
  printf 'printf "%%s" "$repo_root"\n'
} >"$in_repo_harness"

unrelated_repo="$(mktemp -d)"
(cd "$unrelated_repo" && git init -q)
resolved="$(cd "$unrelated_repo" && sh "$in_repo_harness")"
[ "$resolved" = "$this_repo_root" ] || {
  echo "expected repo_root to resolve to this repo (report_dir's own location), not the CWD repo" >&2
  echo "expected: $this_repo_root" >&2
  echo "got:      $resolved" >&2
  exit 1
}
rm -rf "$unrelated_repo" "$in_repo_dir" "$in_repo_harness" "$resolution_harness"

# The uname line must redact the real machine hostname the same way
# environment.txt already redacts repo_root -- run just that one captured
# line in isolation (no docker/network involved) and confirm the real
# hostname is gone and the placeholder is present.
uname_line="$(grep -F 'uname -a | sed' "$capture_script")"
[ -n "$uname_line" ] || {
  echo "expected capture-artifacts.sh to redact the uname hostname" >&2
  exit 1
}
uname_output="$(sh -c "$uname_line")"
printf '%s' "$uname_output" | grep -qF "$(hostname)" && {
  echo "expected the real hostname to be redacted from uname output" >&2
  echo "got: $uname_output" >&2
  exit 1
}
printf '%s' "$uname_output" | grep -qF '<hostname>' || {
  echo "expected the <hostname> placeholder in redacted uname output" >&2
  echo "got: $uname_output" >&2
  exit 1
}

echo "create-smoke-report checks passed"
