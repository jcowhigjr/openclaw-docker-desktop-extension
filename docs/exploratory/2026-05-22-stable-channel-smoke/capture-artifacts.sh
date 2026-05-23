#!/bin/sh
set -eu

# Capture smoke-test CLI artifacts into this packet directory.
# Keep gathering evidence even when one command fails.
report_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
repo_root="$(git rev-parse --show-toplevel)"
release_channel="stable"
release_tag="v0.3.4"

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
    printf 'repo_root=%s\n' "$repo_root"
    printf 'release_channel=%s\n' "$release_channel"
    printf 'release_tag=%s\n' "${release_tag:-}"
    printf '\n[sw_vers]\n'
    sw_vers
    printf '\n[uname]\n'
    uname -a
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
