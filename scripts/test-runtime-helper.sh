#!/bin/sh
set -eu

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

config_path="${tmp_dir}/openclaw.json"
approvals_path="${tmp_dir}/exec-approvals.json"
auth_profiles_path="${tmp_dir}/auth-profiles.json"

cat >"$config_path" <<'JSON'
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "test-token"
    }
  },
  "tools": {
    "exec": {
      "security": "full",
      "ask": "off"
    }
  }
}
JSON

cat >"$approvals_path" <<'JSON'
{
  "version": 1,
  "socket": {
    "path": "/home/node/.openclaw/exec-approvals.sock",
    "token": "preserve-socket-token"
  },
  "defaults": {
    "security": "full",
    "ask": "off",
    "askFallback": "full"
  }
}
JSON

helper_env="OPENCLAW_CONFIG_PATH=${config_path} EXEC_APPROVALS_PATH=${approvals_path} OPENCLAW_AUTH_PROFILES_PATH=${auth_profiles_path}"

token="$(env $helper_env node runtime/openclaw-extension-helper.js gateway-token)"
[ "$token" = "test-token" ]

mode_json="$(env $helper_env node runtime/openclaw-extension-helper.js exec-mode-read)"
printf '%s' "$mode_json" | grep -F '"security":"full"' >/dev/null
printf '%s' "$mode_json" | grep -F 'preserve-socket-token' >/dev/null && {
  echo "exec-mode-read must not expose socket tokens" >&2
  exit 1
}

env $helper_env node runtime/openclaw-extension-helper.js exec-mode-write safer
grep -F '"security": "allowlist"' "$config_path" >/dev/null
grep -F '"askFallback": "deny"' "$approvals_path" >/dev/null
grep -F 'preserve-socket-token' "$approvals_path" >/dev/null

env $helper_env node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"primary": "ollama/qwen3.5:latest"' "$config_path" >/dev/null
grep -F '"ollama:manual"' "$config_path" >/dev/null
# With OPENCLAW_OLLAMA_NUM_CTX unset, num_ctx must be written at the 24576
# default. Omitting it lets Ollama apply a small fixed default (measured 4096),
# which cannot carry an agent turn -- see #213.
grep -F '"num_ctx": 24576' "$config_path" >/dev/null || {
  echo "ollama-config-write must default num_ctx to 24576 when OPENCLAW_OLLAMA_NUM_CTX is unset" >&2
  exit 1
}
# contextTokens caps OpenClaw's input budget and must track num_ctx, or
# OpenClaw budgets against a window Ollama will not serve.
grep -F '"contextTokens": 24576' "$config_path" >/dev/null || {
  echo "ollama-config-write must align contextTokens with num_ctx" >&2
  exit 1
}

# OPENCLAW_OLLAMA_NUM_CTX overrides upward.
env $helper_env OPENCLAW_OLLAMA_NUM_CTX=40960 node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"num_ctx": 40960' "$config_path" >/dev/null
grep -F '"contextTokens": 40960' "$config_path" >/dev/null

# ...and downward, which is the escape hatch for large models on constrained
# hosts (a 27.9B model at a forced 32768 hung past the idle watchdog).
env $helper_env OPENCLAW_OLLAMA_NUM_CTX=8192 node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"num_ctx": 8192' "$config_path" >/dev/null
grep -F '"contextTokens": 8192' "$config_path" >/dev/null

# Invalid and blank values fall back to the default rather than omitting.
env $helper_env OPENCLAW_OLLAMA_NUM_CTX=not-a-number node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"num_ctx": 24576' "$config_path" >/dev/null || {
  echo "invalid OPENCLAW_OLLAMA_NUM_CTX must fall back to the 24576 default" >&2
  exit 1
}
env $helper_env OPENCLAW_OLLAMA_NUM_CTX=0 node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"num_ctx": 24576' "$config_path" >/dev/null || {
  echo "non-positive OPENCLAW_OLLAMA_NUM_CTX must fall back to the 24576 default" >&2
  exit 1
}

# `reasoning: false` alone does not disable Ollama thinking; the helper must
# write params.thinking so OpenClaw promotes it to Ollama's top-level `think`
# field. Default (OPENCLAW_OLLAMA_THINKING unset) is thinking OFF.
env $helper_env node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"thinking": false' "$config_path" >/dev/null
# num_ctx keeps its default, unaffected by the thinking rollback switch.
grep -F '"num_ctx": 24576' "$config_path" >/dev/null || {
  echo "num_ctx default must be independent of OPENCLAW_OLLAMA_THINKING" >&2
  exit 1
}
# `reasoning` must track `thinking`: OpenClaw's native Ollama adapter refuses
# to forward a truthy `think` for a model marked `reasoning: false`, so the
# default (thinking off) must pair with `reasoning: false`.
grep -F '"reasoning": false' "$config_path" >/dev/null

# OPENCLAW_OLLAMA_THINKING is the rollback switch to turn thinking back on.
env $helper_env OPENCLAW_OLLAMA_THINKING=true node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"thinking": true' "$config_path" >/dev/null
grep -F '"num_ctx": 24576' "$config_path" >/dev/null || {
  echo "num_ctx default must be independent of OPENCLAW_OLLAMA_THINKING" >&2
  exit 1
}
# `reasoning` must flip with `thinking`, or OpenClaw drops the forwarded
# `think` request and the rollback switch is inert.
grep -F '"reasoning": true' "$config_path" >/dev/null

# --- localModelLean (#198) ---
# Fresh config (no `experimental` key) must gain localModelLean: true — the
# Ollama path is by definition the constrained-hardware path.
grep -F '"localModelLean": true' "$config_path" >/dev/null

# An explicit `false` must survive a re-apply. This is an own-property
# presence check, not a truthiness check: a truthiness check would flip a
# deliberate opt-out back to `true` on every re-apply.
lean_false_path="${tmp_dir}/openclaw-lean-false.json"
cat >"$lean_false_path" <<'JSON'
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": false
      }
    }
  }
}
JSON
env "OPENCLAW_CONFIG_PATH=${lean_false_path}" node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"localModelLean": false' "$lean_false_path" >/dev/null

# An explicit `true` must stay `true` (idempotent).
lean_true_path="${tmp_dir}/openclaw-lean-true.json"
cat >"$lean_true_path" <<'JSON'
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      }
    }
  }
}
JSON
env "OPENCLAW_CONFIG_PATH=${lean_true_path}" node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"localModelLean": true' "$lean_true_path" >/dev/null

# A sibling key already under `experimental` must be preserved (merge, not
# clobber) when localModelLean is filled in alongside it.
lean_sibling_path="${tmp_dir}/openclaw-lean-sibling.json"
cat >"$lean_sibling_path" <<'JSON'
{
  "agents": {
    "defaults": {
      "experimental": {
        "someOtherFlag": true
      }
    }
  }
}
JSON
env "OPENCLAW_CONFIG_PATH=${lean_sibling_path}" node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"localModelLean": true' "$lean_sibling_path" >/dev/null
grep -F '"someOtherFlag": true' "$lean_sibling_path" >/dev/null

# The #197/#213 invariants must still hold in the same written config:
# params.thinking present, reasoning matching it, and num_ctx defaulted rather
# than omitted.
grep -F '"thinking": false' "$lean_false_path" >/dev/null
grep -F '"reasoning": false' "$lean_false_path" >/dev/null
grep -F '"num_ctx": 24576' "$lean_false_path" >/dev/null || {
  echo "ollama-config-write must default num_ctx to 24576 when OPENCLAW_OLLAMA_NUM_CTX is unset" >&2
  exit 1
}

env $helper_env node runtime/openclaw-extension-helper.js ollama-auth-profiles-write
grep -F '"key": "ollama-local"' "$auth_profiles_path" >/dev/null

if env "OPENCLAW_AUTH_PROFILES_PATH=${tmp_dir}/wrong-name.json" \
  node runtime/openclaw-extension-helper.js ollama-auth-profiles-write 2>"${tmp_dir}/invalid-path.err"; then
  echo "ollama-auth-profiles-write must reject invalid auth profile filenames" >&2
  exit 1
fi
grep -F 'auth profile path must end with auth-profiles.json' "${tmp_dir}/invalid-path.err" >/dev/null

# --- Ollama auth profile propagation across all agents ---
# When the single-file override is NOT set, the helper enumerates every agent
# directory under OPENCLAW_AGENTS_DIR and writes ollama:manual to each.

agents_dir="${tmp_dir}/agents"
mkdir -p "${agents_dir}/main/agent"
mkdir -p "${agents_dir}/heartbeat/agent"
# Pre-existing profile in main must be preserved by the merge.
cat >"${agents_dir}/main/agent/auth-profiles.json" <<'JSON'
{
  "version": 1,
  "profiles": {
    "anthropic:default": { "type": "api_key", "provider": "anthropic", "key": "sk-existing" }
  }
}
JSON
# A stray non-agent directory (no agent/ subdir) and a stray file must be skipped.
mkdir -p "${agents_dir}/not-an-agent"
: >"${agents_dir}/loose-file"

agents_env="OPENCLAW_AGENTS_DIR=${agents_dir}"

env $agents_env node runtime/openclaw-extension-helper.js ollama-auth-profiles-write
# Both agents got the profile.
grep -F '"ollama:manual"' "${agents_dir}/main/agent/auth-profiles.json" >/dev/null
grep -F '"ollama:manual"' "${agents_dir}/heartbeat/agent/auth-profiles.json" >/dev/null
# Existing profile preserved (merge, not clobber).
grep -F '"anthropic:default"' "${agents_dir}/main/agent/auth-profiles.json" >/dev/null
# Stray entries skipped.
[ ! -e "${agents_dir}/not-an-agent/agent/auth-profiles.json" ]
[ ! -d "${agents_dir}/loose-file/agent" ]

# Idempotent: a second run leaves files byte-identical.
main_before="$(cat "${agents_dir}/main/agent/auth-profiles.json")"
env $agents_env node runtime/openclaw-extension-helper.js ollama-auth-profiles-write
main_after="$(cat "${agents_dir}/main/agent/auth-profiles.json")"
[ "$main_before" = "$main_after" ]
# Single ollama:manual key (no duplication).
[ "$(grep -c -F '"ollama:manual"' "${agents_dir}/main/agent/auth-profiles.json")" = "1" ]

# Missing agents dir still writes main and exits 0.
missing_dir="${tmp_dir}/no-agents-here"
env "OPENCLAW_AGENTS_DIR=${missing_dir}" node runtime/openclaw-extension-helper.js ollama-auth-profiles-write
grep -F '"ollama:manual"' "${missing_dir}/main/agent/auth-profiles.json" >/dev/null

echo "runtime helper checks passed"
