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

env $helper_env node runtime/openclaw-extension-helper.js ollama-auth-profiles-write
grep -F '"key": "ollama-local"' "$auth_profiles_path" >/dev/null

echo "runtime helper checks passed"
