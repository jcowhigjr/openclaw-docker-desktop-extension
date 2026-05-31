#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 John Cowhig Jr.
set -eu

tmp_dir="/tmp/openclaw-$(id -u)"
mkdir -p "$tmp_dir"
chmod 700 "$tmp_dir"

docker-entrypoint.sh node openclaw.mjs gateway --allow-unconfigured >/tmp/openclaw.log 2>&1 &
openclaw_pid=$!

socat TCP-LISTEN:18790,bind=0.0.0.0,reuseaddr,fork TCP:127.0.0.1:18789 &
socat_pid=$!

shutdown() {
  kill "$openclaw_pid" "$socat_pid" 2>/dev/null || true
  wait "$openclaw_pid" "$socat_pid" 2>/dev/null || true
}

trap shutdown INT TERM

while :; do
  if ! kill -0 "$openclaw_pid" 2>/dev/null; then
    wait "$openclaw_pid"
    status=$?
    kill "$socat_pid" 2>/dev/null || true
    exit "$status"
  fi

  if ! kill -0 "$socat_pid" 2>/dev/null; then
    wait "$socat_pid"
    status=$?
    kill "$openclaw_pid" 2>/dev/null || true
    exit "$status"
  fi

  sleep 2
done
