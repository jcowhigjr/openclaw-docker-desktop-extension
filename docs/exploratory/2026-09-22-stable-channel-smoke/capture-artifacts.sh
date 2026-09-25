#!/bin/sh
set -eu

# Capture smoke-test CLI artifacts into this packet directory.
# Keep gathering evidence even when one command fails.
report_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
# BEGIN REPO_ROOT RESOLUTION -- scripts/test-create-smoke-report.sh extracts
# this exact block by these markers to test it in isolation, without
# exercising any real docker/make/network call. Keep the markers and keep
# this block self-contained (report_dir must already be set before it, and
# it must not read anything except REPO_ROOT and report_dir) if you edit it.
#
# Derived at run time, not baked in here: the generator's own resolved path
# on the maintainer's machine must never be interpolated into a committed,
# publicly-readable script. This regressed once already (2026-09-22) and
# leaked an absolute workstation path into a public packet.
#
# Bind git discovery to this script's own location (report_dir), not the
# caller's CWD -- a bare "git rev-parse --show-toplevel" resolves relative to
# CWD and regressed a second time (2026-09-22): it failed outside any git
# checkout and silently picked an unrelated repository when run from inside
# one. REPO_ROOT is the explicit override for a packet copied somewhere that
# is not a git checkout at all.
if [ -n "${REPO_ROOT:-}" ]; then
  repo_root="$REPO_ROOT"
elif ! repo_root="$(git -C "$report_dir" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "capture-artifacts.sh: could not determine the repo root from this script's own location ($report_dir)." >&2
  echo "Set REPO_ROOT explicitly, e.g.: REPO_ROOT=/path/to/repo $0" >&2
  exit 1
fi
# END REPO_ROOT RESOLUTION
release_channel="stable"
release_tag="v0.5.0"

capture_cmd() {
  output_file="$1"
  shift

  if "$@" >"${report_dir}/${output_file}" 2>&1; then
    return 0
  fi

  status="$?"
  {
    printf 'capture failed with exit %s\n' "$status"
    printf 'command:'
    for arg in "$@"; do
      printf ' %s' "$arg"
    done
    printf '\n\n'
    cat "${report_dir}/${output_file}"
  } >"${report_dir}/${output_file}.tmp"
  mv "${report_dir}/${output_file}.tmp" "${report_dir}/${output_file}"
}

capture_environment() {
  output_file="${report_dir}/environment.txt"

  {
    printf 'captured_at=%s\n' "$(date -u +%FT%TZ)"
    # Never print the real absolute path: these packets are committed to a
    # public repo. redacted, not the real $repo_root value, on purpose.
    printf 'repo_root=<redacted>\n'
    printf 'release_channel=%s\n' "$release_channel"
    printf 'release_tag=%s\n' "${release_tag:-}"
    printf '\n[sw_vers]\n'
    sw_vers
    printf '\n[uname]\n'
    # uname -a's second field is the machine hostname -- redact it the same
    # way repo_root is redacted above; a public packet should not carry it.
    # Use the full hostname, not -s: uname embeds it with any local-network
    # domain suffix (e.g. "mac.lan"), and matching only the short form left
    # that suffix exposed.
    uname -a | sed "s/$(hostname)/<hostname>/"
    printf '\n[docker version]\n'
    docker version
  } >"$output_file" 2>&1 || {
    status="$?"
    {
      printf 'capture failed with exit %s\n' "$status"
      printf 'command: capture_environment\n\n'
      cat "$output_file"
    } >"${output_file}.tmp"
    mv "${output_file}.tmp" "$output_file"
  }
}

capture_environment

if [ -n "$release_tag" ]; then
  capture_cmd verify-release-channel.txt make -C "$repo_root" verify-release-channel RELEASE_CHANNEL="$release_channel" EXPECTED_RELEASE_TAG="$release_tag"
  capture_cmd verify-channel-install-dry-run.txt make -C "$repo_root" verify-channel-install RELEASE_CHANNEL="$release_channel" EXPECTED_RELEASE_TAG="$release_tag" DRY_RUN=1
else
  capture_cmd verify-release-channel.txt make -C "$repo_root" verify-release-channel RELEASE_CHANNEL="$release_channel"
  capture_cmd verify-channel-install-dry-run.txt make -C "$repo_root" verify-channel-install RELEASE_CHANNEL="$release_channel" DRY_RUN=1
fi

capture_cmd docker-extension-ls.txt docker extension ls
capture_cmd docker-extension-inspect.txt docker extension inspect openclaw-docker-extension
capture_cmd docker-ps-a.txt docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
capture_cmd docker-image-ls.txt docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'
capture_cmd openclaw-service-inspect.txt docker inspect openclaw-docker-extension-service
capture_cmd openclaw-service.log docker logs openclaw-docker-extension-service
capture_cmd control-ui-healthz.txt curl -fsS http://127.0.0.1:18789/healthz
