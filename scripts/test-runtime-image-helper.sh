#!/bin/sh
# Verify that the built runtime Docker image contains the helper script.
# This catches the case where runtime/ content was changed but the image
# was never rebuilt after merging (the gap that caused v0.3.4 to ship
# without openclaw-extension-helper.js).
set -eu

image="${RUNTIME_IMAGE:-openclaw-docker-extension-runtime}:${RUNTIME_TAG:-dev}"

if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "runtime image $image not found locally; building it now..." >&2
  make build-runtime
fi

if ! docker run --rm --entrypoint /bin/sh "$image" \
  -c 'test -f /usr/local/bin/openclaw-extension-helper.js'; then
  echo "FAIL: $image is missing /usr/local/bin/openclaw-extension-helper.js" >&2
  exit 1
fi

if ! docker run --rm --entrypoint /bin/sh "$image" \
  -c 'test -f /usr/local/bin/openclaw-bridge.sh'; then
  echo "FAIL: $image is missing /usr/local/bin/openclaw-bridge.sh" >&2
  exit 1
fi

# Container-parity check for Ollama auth-profile propagation. Runs the real
# helper inside the built image against a seeded agents dir. This exercises the
# packaged path layout and node runtime without any host Ollama, model, or GUI.
# ollama-auth-profiles-write only writes files (it never contacts Ollama), so
# this fully covers the propagation behavior.
if ! docker run --rm --entrypoint /bin/sh "$image" -c '
  set -eu
  base=/tmp/agents
  mkdir -p "$base/main/agent" "$base/heartbeat/agent" "$base/not-an-agent"
  : >"$base/loose-file"
  # Pre-existing profile in main must survive the merge.
  cat >"$base/main/agent/auth-profiles.json" <<JSON
{ "version": 1, "profiles": { "anthropic:default": { "type": "api_key", "provider": "anthropic", "key": "sk-existing" } } }
JSON
  OPENCLAW_AGENTS_DIR="$base" node /usr/local/bin/openclaw-extension-helper.js ollama-auth-profiles-write
  grep -q ollama:manual "$base/main/agent/auth-profiles.json"
  grep -q ollama:manual "$base/heartbeat/agent/auth-profiles.json"
  grep -q anthropic:default "$base/main/agent/auth-profiles.json"
  test ! -e "$base/not-an-agent/agent/auth-profiles.json"
'; then
  echo "FAIL: $image did not propagate the Ollama auth profile to all agents" >&2
  exit 1
fi

echo "runtime image helper checks passed"
