#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Copyright 2025-2026 John Cowhig Jr.
set -eu

tmp_dir="/tmp/openclaw-$(id -u)"
mkdir -p "$tmp_dir"
chmod 700 "$tmp_dir"

# Run OpenClaw's supported repair path before the gateway holds the state
# database: it applies upstream's forward migrations (retired JSON stores,
# schema moves) and mints a gateway token on a fresh volume, without which the
# gateway refuses to bind and exits 78 (#241). Failures are logged, not fatal:
# the gateway's own startup error is the better signal.
openclaw doctor --fix --non-interactive --generate-gateway-token >/tmp/openclaw-doctor.log 2>&1 ||
  echo "openclaw doctor exited $?" >>/tmp/openclaw-doctor.log

docker-entrypoint.sh node openclaw.mjs gateway --allow-unconfigured >/tmp/openclaw.log 2>&1 &
openclaw_pid=$!

socat TCP-LISTEN:18790,bind=0.0.0.0,reuseaddr,fork TCP:127.0.0.1:18789 &
socat_pid=$!

# Loopback relay to host Ollama. Node's TCP keepalive probes through
# host.docker.internal go unanswered by Docker Desktop's forwarder, so any
# model call that waits ~70s for a first byte dies with ETIMEDOUT. Through this
# relay the probes are answered by the container kernel (#246).
socat TCP-LISTEN:11434,bind=127.0.0.1,reuseaddr,fork TCP:host.docker.internal:11434 &
ollama_relay_pid=$!

shutdown() {
  kill "$openclaw_pid" "$socat_pid" "$ollama_relay_pid" 2>/dev/null || true
  wait "$openclaw_pid" "$socat_pid" "$ollama_relay_pid" 2>/dev/null || true
}

trap shutdown INT TERM

# Any child exiting tears the others down and exits with that child's status,
# so Docker restarts or reports the container instead of leaving it half-alive.
while :; do
  for child_pid in "$openclaw_pid" "$socat_pid" "$ollama_relay_pid"; do
    if ! kill -0 "$child_pid" 2>/dev/null; then
      status=0
      wait "$child_pid" || status=$?
      shutdown
      exit "$status"
    fi
  done

  sleep 2
done
