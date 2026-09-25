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

# A fresh volume has no gateway token; doctor mints one and applies upstream
# migrations, and it must run before the gateway holds the state database (#241).
doctor_line="$(grep -n -F 'openclaw doctor --fix --non-interactive --generate-gateway-token' "$script" | head -1 | cut -d: -f1)"
gateway_line="$(grep -n -F 'docker-entrypoint.sh node openclaw.mjs gateway' "$script" | head -1 | cut -d: -f1)"
if [ -z "$doctor_line" ] || [ -z "$gateway_line" ] || [ "$doctor_line" -ge "$gateway_line" ]; then
  echo "runtime bridge must run openclaw doctor --fix --non-interactive --generate-gateway-token before starting the gateway" >&2
  exit 1
fi

# The Ollama relay must exist, bind container loopback only, and be supervised (#246).
if ! grep -F 'socat TCP-LISTEN:11434,bind=127.0.0.1,reuseaddr,fork TCP:host.docker.internal:11434' "$script" >/dev/null; then
  echo "runtime bridge must relay 127.0.0.1:11434 to host.docker.internal:11434" >&2
  exit 1
fi

if grep -E 'TCP-LISTEN:11434,bind=0\.0\.0\.0' "$script" >/dev/null; then
  echo "the Ollama relay must not listen on all interfaces" >&2
  exit 1
fi

if ! grep -F 'ollama_relay_pid=$!' "$script" >/dev/null; then
  echo "runtime bridge must track the Ollama relay process" >&2
  exit 1
fi

sh -n "$script"

echo "runtime bridge checks passed"
