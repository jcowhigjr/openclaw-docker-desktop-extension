#!/bin/sh
set -eu

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

config_path="${tmp_dir}/openclaw.json"

cat >"$config_path" <<'JSON'
{
  "gateway": {
    "auth": {
      "mode": "token",
      "token": "test-token"
    }
  },
  "tools": {
    "byProvider": {
      "anthropic": { "profile": "minimal" }
    }
  }
}
JSON

# Fake OpenClaw CLI: records argv and stdin, prints canned output captured from
# OpenClaw 2026.9.3. Writes that OpenClaw owns the storage format of must go
# through this CLI, never through files (#242, #245).
fake_bin="${tmp_dir}/bin"
calls_log="${tmp_dir}/openclaw.calls"
stdin_log="${tmp_dir}/openclaw.stdin"
mkdir -p "$fake_bin"
cat >"${fake_bin}/openclaw" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >>"$FAKE_OPENCLAW_CALLS"
if [ -n "${FAKE_OPENCLAW_FAIL:-}" ]; then
  echo "simulated failure for: $*" >&2
  exit 3
fi
case "$*" in
  "exec-policy show --json")
    echo "[config] warnings: plugins.entries.codex: plugin disabled but config is present"
    cat "$FAKE_EXEC_POLICY"
    ;;
  "exec-policy preset "*)
    echo '{"ok":true}'
    ;;
  "agents list --json")
    echo '[{"id":"main","isDefault":true},{"id":"heartbeat"},{"id":"../escape"}]'
    ;;
  "models auth paste-api-key "*)
    printf '%s|' "$*" >>"$FAKE_OPENCLAW_STDIN"
    cat >>"$FAKE_OPENCLAW_STDIN"
    ;;
  *)
    echo "unexpected openclaw call: $*" >&2
    exit 2
    ;;
esac
SH
chmod +x "${fake_bin}/openclaw"
# The helper resolves `openclaw` from PATH, so the fake shadows any real install.
PATH="${fake_bin}:${PATH}"
export PATH

exec_policy_path="${tmp_dir}/exec-policy.json"
write_exec_policy() {
  cat >"$exec_policy_path" <<JSON
{"configPath":"/home/node/.openclaw/openclaw.json","approvalsExists":false,"effectivePolicy":{"scopes":[{"scopeLabel":"tools.exec","agentId":"main","security":{"requested":"$1","effective":"$1"},"ask":{"requested":"$2","effective":"$2"},"askFallback":{"effective":"$3"}}]}}
JSON
}

helper_env="OPENCLAW_CONFIG_PATH=${config_path} FAKE_OPENCLAW_CALLS=${calls_log} FAKE_OPENCLAW_STDIN=${stdin_log} FAKE_EXEC_POLICY=${exec_policy_path}"

token="$(env $helper_env node runtime/openclaw-extension-helper.js gateway-token)"
[ "$token" = "test-token" ]

# --- exec mode (#245) ---
# Unconfigured OpenClaw enforces full/off; the helper must report that, parsing
# past the diagnostic line OpenClaw prints ahead of the JSON.
write_exec_policy full off deny
mode_json="$(env $helper_env node runtime/openclaw-extension-helper.js exec-mode-read)"
[ "$mode_json" = '{"security":"full","ask":"off","askFallback":"deny"}' ] || {
  echo "exec-mode-read must report the effective policy, got: $mode_json" >&2
  exit 1
}

write_exec_policy allowlist on-miss deny
mode_json="$(env $helper_env node runtime/openclaw-extension-helper.js exec-mode-read)"
[ "$mode_json" = '{"security":"allowlist","ask":"on-miss","askFallback":"deny"}' ]

printf '{"effectivePolicy":{"scopes":[]}}\n' >"$exec_policy_path"
if env $helper_env node runtime/openclaw-extension-helper.js exec-mode-read 2>"${tmp_dir}/mode-read.err"; then
  echo "exec-mode-read must fail when OpenClaw reports no policy scope" >&2
  exit 1
fi
grep -F 'did not report an effective security/ask policy' "${tmp_dir}/mode-read.err" >/dev/null

: >"$calls_log"
env $helper_env node runtime/openclaw-extension-helper.js exec-mode-write safer
env $helper_env node runtime/openclaw-extension-helper.js exec-mode-write full
[ "$(cat "$calls_log")" = "exec-policy preset cautious --json
exec-policy preset yolo --json" ] || {
  echo "exec-mode-write must map safer/full to the cautious/yolo presets, got: $(cat "$calls_log")" >&2
  exit 1
}
if env $helper_env node runtime/openclaw-extension-helper.js exec-mode-write reckless 2>/dev/null; then
  echo "exec-mode-write must reject unknown modes" >&2
  exit 1
fi
[ ! -e "${tmp_dir}/exec-approvals.json" ]
if grep -F '"exec"' "$config_path" >/dev/null; then
  echo "exec-mode-write must not write tools.exec into openclaw.json directly" >&2
  exit 1
fi

if env $helper_env FAKE_OPENCLAW_FAIL=1 node runtime/openclaw-extension-helper.js exec-mode-write safer 2>"${tmp_dir}/mode-write.err"; then
  echo "exec-mode-write must fail when the OpenClaw CLI fails" >&2
  exit 1
fi
grep -F 'openclaw exec-policy preset cautious exited 3' "${tmp_dir}/mode-write.err" >/dev/null

env $helper_env node runtime/openclaw-extension-helper.js ollama-config-write qwen3.5:latest
grep -F '"primary": "ollama/qwen3.5:latest"' "$config_path" >/dev/null
grep -F '"ollama:manual"' "$config_path" >/dev/null

# Local-model runtime settings (#246, #247). Assert on parsed JSON, not grep,
# so key placement is checked too.
node -e '
const c = require(process.argv[1]);
const fail = (m) => { console.error(m); process.exit(1); };
if (c.models.providers.ollama.baseUrl !== "http://127.0.0.1:11434") fail("baseUrl must be the in-container relay (#246)");
if (c.tools.toolSearch !== false) fail("tools.toolSearch must be false for local models (#247)");
const p = c.tools.byProvider.ollama;
if (!p || p.profile !== "coding") fail("tools.byProvider.ollama.profile must be coding");
for (const t of ["group:sessions", "web_search", "x_search", "view_image", "code_execution", "image_generate"]) {
  if (!p.deny.includes(t)) fail("tools.byProvider.ollama.deny must include " + t);
}
for (const t of ["exec", "read", "write", "group:fs", "group:runtime"]) {
  if (p.deny.includes(t)) fail("the Ollama tool policy must not deny " + t);
}
if (!c.tools.byProvider.anthropic || c.tools.byProvider.anthropic.profile !== "minimal") fail("other byProvider entries must be preserved");
if (c.agents.defaults.timeoutSeconds !== 900) fail("agents.defaults.timeoutSeconds must be 900");
' "$config_path"
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

# --- ollama-config-refresh on every start (#249 upgrades) ---
# An install configured by an older release keeps its model entry but gains the
# extension-managed runtime settings; user params are preserved.
legacy_path="${tmp_dir}/openclaw-legacy.json"
cat >"$legacy_path" <<'JSON'
{
  "agents": { "defaults": { "model": { "primary": "ollama/qwen3:8b" }, "timeoutSeconds": 300 } },
  "models": { "providers": { "ollama": {
    "api": "ollama", "apiKey": "ollama-local", "baseUrl": "http://host.docker.internal:11434",
    "models": [ { "id": "qwen3:8b", "name": "qwen3:8b", "reasoning": true, "contextTokens": 8192,
                  "params": { "thinking": true, "num_ctx": 8192 } } ]
  } } },
  "tools": { "byProvider": { "anthropic": { "profile": "minimal" } } }
}
JSON
refresh_out="$(env "OPENCLAW_CONFIG_PATH=${legacy_path}" node runtime/openclaw-extension-helper.js ollama-config-refresh)"
printf '%s' "$refresh_out" | grep -F 'updated extension-managed Ollama settings' >/dev/null
node -e '
const c = require(process.argv[1]);
const fail = (m) => { console.error(m); process.exit(1); };
const p = c.models.providers.ollama;
if (p.baseUrl !== "http://127.0.0.1:11434") fail("refresh must move the provider to the relay");
if (c.tools.toolSearch !== false || !c.tools.byProvider.ollama) fail("refresh must apply the local tool policy");
if (c.tools.byProvider.anthropic.profile !== "minimal") fail("refresh must keep other byProvider entries");
if (c.agents.defaults.timeoutSeconds !== 900) fail("refresh must raise the run budget");
if (c.agents.defaults.experimental.localModelLean !== true) fail("refresh must fill in localModelLean");
const m = p.models[0];
if (m.params.num_ctx !== 8192 || m.contextTokens !== 8192 || m.params.thinking !== true) fail("refresh must keep the user model params");
if (c.agents.defaults.model.primary !== "ollama/qwen3:8b") fail("refresh must keep the default model");
' "$legacy_path"
[ -f "${legacy_path}.bak" ]

# A second start changes nothing and does not rewrite the file.
before_refresh="$(cat "$legacy_path")"
rm -f "${legacy_path}.bak"
refresh_out="$(env "OPENCLAW_CONFIG_PATH=${legacy_path}" node runtime/openclaw-extension-helper.js ollama-config-refresh)"
printf '%s' "$refresh_out" | grep -F 'already current' >/dev/null
[ "$before_refresh" = "$(cat "$legacy_path")" ]
[ ! -e "${legacy_path}.bak" ]

# A provider the user pointed elsewhere is left alone.
custom_path="${tmp_dir}/openclaw-custom-url.json"
cat >"$custom_path" <<'JSON'
{
  "agents": { "defaults": { "model": { "primary": "ollama/llama3" } } },
  "models": { "providers": { "ollama": { "baseUrl": "http://192.168.1.50:11434", "models": [] } } }
}
JSON
custom_before="$(cat "$custom_path")"
env "OPENCLAW_CONFIG_PATH=${custom_path}" node runtime/openclaw-extension-helper.js ollama-config-refresh | grep -F 'custom URL' >/dev/null
[ "$custom_before" = "$(cat "$custom_path")" ]

# A non-Ollama default, or no config at all, is a no-op.
cloud_path="${tmp_dir}/openclaw-cloud.json"
printf '{"agents":{"defaults":{"model":{"primary":"anthropic/claude"}}}}\n' >"$cloud_path"
cloud_before="$(cat "$cloud_path")"
env "OPENCLAW_CONFIG_PATH=${cloud_path}" node runtime/openclaw-extension-helper.js ollama-config-refresh | grep -F 'not an Ollama model' >/dev/null
[ "$cloud_before" = "$(cat "$cloud_path")" ]
env "OPENCLAW_CONFIG_PATH=${tmp_dir}/does-not-exist.json" node runtime/openclaw-extension-helper.js ollama-config-refresh >/dev/null
[ ! -e "${tmp_dir}/does-not-exist.json" ]

# --- Ollama auth through OpenClaw's auth store (#242) ---
# Every agent OpenClaw lists gets the key via `models auth paste-api-key` on
# stdin; unsafe ids are skipped and no auth-profiles.json is written.
: >"$calls_log"
: >"$stdin_log"
env $helper_env node runtime/openclaw-extension-helper.js ollama-auth-write
grep -F 'models auth paste-api-key --provider ollama --agent main' "$calls_log" >/dev/null
grep -F 'models auth paste-api-key --provider ollama --agent heartbeat' "$calls_log" >/dev/null
if grep -F 'escape' "$calls_log" >/dev/null; then
  echo "ollama-auth-write must skip agent ids that are not plain identifiers" >&2
  exit 1
fi
grep -F -- '--agent main|ollama-local' "$stdin_log" >/dev/null || {
  echo "ollama-auth-write must pass the key on stdin, not argv" >&2
  exit 1
}
if grep -F 'ollama-local' "$calls_log" >/dev/null; then
  echo "the Ollama key must not appear in argv" >&2
  exit 1
fi
if find "$tmp_dir" -name 'auth-profiles.json' | grep . >/dev/null; then
  echo "ollama-auth-write must not write the retired auth-profiles.json" >&2
  exit 1
fi

# If OpenClaw cannot list agents, main is still configured.
list_fail_bin="${tmp_dir}/bin-list-fail"
mkdir -p "$list_fail_bin"
cat >"${list_fail_bin}/openclaw" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >>"$FAKE_OPENCLAW_CALLS"
case "$*" in
  "agents list --json") echo "agents unavailable" >&2; exit 4 ;;
  *) cat >/dev/null ;;
esac
SH
chmod +x "${list_fail_bin}/openclaw"
: >"$calls_log"
(PATH="${list_fail_bin}:${PATH}"; export PATH; env $helper_env node runtime/openclaw-extension-helper.js ollama-auth-write 2>/dev/null)
grep -F 'models auth paste-api-key --provider ollama --agent main' "$calls_log" >/dev/null

if env $helper_env FAKE_OPENCLAW_FAIL=1 node runtime/openclaw-extension-helper.js ollama-auth-write 2>/dev/null; then
  echo "ollama-auth-write must fail when OpenClaw rejects the key" >&2
  exit 1
fi

# --- ollama-warmup (#241) ---
# A local stub server stands in for Ollama: 200 on success, an Ollama-style
# 500 whose body itself says "timed out" (must still read as a broken load),
# and a slow response that trips the helper's own timeout.
server_port_file="${tmp_dir}/server.port"
server_body_file="${tmp_dir}/server.body"
node -e '
const http = require("http");
const fs = require("fs");
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    fs.writeFileSync(process.argv[2], body);
    if (parsed.model === "broken:model") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "timed out waiting for llama runner to start" }));
    } else if (parsed.model === "slow:model") {
      setTimeout(() => { res.writeHead(200); res.end("{}"); }, 3000);
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{\"done\":true}");
    }
  });
});
server.listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[1], String(server.address().port)));
setTimeout(() => process.exit(0), 20000);
' "$server_port_file" "$server_body_file" &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; rm -rf "$tmp_dir"' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ -s "$server_port_file" ] && break
  sleep 0.2
done
warmup_base="http://127.0.0.1:$(cat "$server_port_file")"
# The CLI always targets the relay, so call the exported function with the stub's URL.
warmup() {
  node -e '
const { ollamaWarmup } = require("./runtime/openclaw-extension-helper.js");
ollamaWarmup(process.argv[1], process.argv[2], process.argv[3]).then(
  () => process.exit(0),
  (error) => { process.stderr.write(error.message + "\n"); process.exit(1); },
);
' "$1" "$2" "$warmup_base"
}

warmup qwen3:8b 5
node -e '
const body = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (body.model !== "qwen3:8b" || body.keep_alive !== "30m") { console.error("unexpected warmup body: " + JSON.stringify(body)); process.exit(1); }
' "$server_body_file"

if warmup broken:model 5 2>"${tmp_dir}/warmup-500.err"; then
  echo "ollama-warmup must fail on an HTTP error" >&2
  exit 1
fi
grep -F 'returned error HTTP 500' "${tmp_dir}/warmup-500.err" >/dev/null

if warmup slow:model 1 2>"${tmp_dir}/warmup-timeout.err"; then
  echo "ollama-warmup must fail when the timeout elapses" >&2
  exit 1
fi
grep -F 'ollama-warmup timed out after 1s loading slow:model' "${tmp_dir}/warmup-timeout.err" >/dev/null
if grep -F 'returned error' "${tmp_dir}/warmup-timeout.err" >/dev/null; then
  echo "a warmup timeout must not be worded like an HTTP error" >&2
  exit 1
fi

if node runtime/openclaw-extension-helper.js ollama-warmup 2>"${tmp_dir}/warmup-missing.err"; then
  echo "ollama-warmup must require a model" >&2
  exit 1
fi
grep -F 'ollama-warmup requires a model' "${tmp_dir}/warmup-missing.err" >/dev/null

echo "runtime helper checks passed"
