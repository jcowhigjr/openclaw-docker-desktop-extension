#!/bin/sh
set -eu

script="runtime/openclaw-bridge.sh"

if ! grep -F 'tmp_dir="/tmp/openclaw-$(id -u)"' "$script" >/dev/null; then
  echo "runtime bridge must create the OpenClaw fallback temp dir for the node user" >&2
  exit 1
fi

if ! grep -F 'openclaw_pid=$!' "$script" >/dev/null; then
  echo "runtime bridge must track the OpenClaw child process" >&2
  exit 1
fi

if ! grep -F 'socat_pid=$!' "$script" >/dev/null; then
  echo "runtime bridge must track the socat child process" >&2
  exit 1
fi

if ! grep -F 'docker-entrypoint.sh node openclaw.mjs gateway --allow-unconfigured' "$script" >/dev/null; then
  echo "runtime bridge must launch OpenClaw through the upstream gateway entrypoint" >&2
  exit 1
fi

if grep -F 'exec socat' "$script" >/dev/null; then
  echo "runtime bridge must not exec socat and orphan OpenClaw failures" >&2
  exit 1
fi

echo "runtime bridge checks passed"
