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

# Parity check against the OpenClaw bundled in the image. Unit tests stub the
# CLI; this runs the real helper against the real `openclaw` on a fresh, empty
# home, so a storage-format change upstream (the cause of #242 and #245, which
# shipped because tests only checked that files were written) fails here.
# Needs no host Ollama, model, or GUI.
if ! docker run --rm --entrypoint /bin/sh -e HOME=/tmp/parity-home "$image" -c '
  set -eu
  helper=/usr/local/bin/openclaw-extension-helper.js
  export OPENCLAW_CONFIG_PATH="$HOME/.openclaw/openclaw.json"
  mkdir -p "$HOME"

  # Fresh volume: doctor must mint the gateway token the bridge relies on (#241).
  openclaw doctor --fix --non-interactive --generate-gateway-token >/tmp/doctor.log 2>&1
  token="$(node "$helper" gateway-token)"
  [ "${#token}" -ge 16 ] || { echo "doctor did not produce a gateway token"; exit 1; }

  # Unconfigured OpenClaw enforces full/off, and the helper must say so (#245).
  mode="$(node "$helper" exec-mode-read)"
  [ "$mode" = "{\"security\":\"full\",\"ask\":\"off\",\"askFallback\":\"deny\"}" ] || { echo "fresh exec mode: $mode"; exit 1; }
  node "$helper" exec-mode-write safer
  mode="$(node "$helper" exec-mode-read)"
  [ "$mode" = "{\"security\":\"allowlist\",\"ask\":\"on-miss\",\"askFallback\":\"deny\"}" ] || { echo "safer exec mode: $mode"; exit 1; }
  node "$helper" exec-mode-write full
  mode="$(node "$helper" exec-mode-read)"
  [ "$mode" = "{\"security\":\"full\",\"ask\":\"off\",\"askFallback\":\"full\"}" ] || { echo "full exec mode: $mode"; exit 1; }
  test ! -e "$HOME/.openclaw/exec-approvals.json"

  # The written Ollama config must load in the real OpenClaw schema (#246, #247).
  node "$helper" ollama-config-write qwen3:8b
  [ "$(openclaw config get tools.toolSearch 2>/dev/null | tail -1)" = "false" ] || { echo "tools.toolSearch not accepted"; exit 1; }
  openclaw config get models.providers.ollama.baseUrl 2>/dev/null | grep -q "http://127.0.0.1:11434"
  openclaw config get tools.byProvider.ollama.profile 2>/dev/null | grep -q coding

  # Auth goes through the real auth store; no legacy JSON may appear (#242).
  node "$helper" ollama-auth-write
  openclaw models auth list --agent main 2>/dev/null | grep -q "ollama:manual"
  if find "$HOME/.openclaw" -name auth-profiles.json | grep -q .; then
    echo "legacy auth-profiles.json was written"; exit 1
  fi
'; then
  echo "FAIL: $image helper does not round-trip through the bundled OpenClaw" >&2
  exit 1
fi

echo "runtime image helper checks passed"
