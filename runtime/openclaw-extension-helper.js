#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/home/node/.openclaw/openclaw.json';
// OpenClaw CLI used for every write that OpenClaw owns the storage format of.
// OpenClaw 2026.9.3 moved auth profiles and exec approvals into SQLite and
// refuses the JSON files this helper used to write (#242, #245), so those
// writes go through its documented CLI instead of files. Overridable for tests.
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const MAIN_AGENT_ID = 'main';
const OLLAMA_API_KEY = 'ollama-local';
// In-container loopback relay to host Ollama, started by openclaw-bridge.sh.
// Node's TCP keepalive probes through host.docker.internal go unanswered by
// Docker Desktop's forwarder, so any request that waits ~70s for a first byte
// (cold load, long prefill) dies with ETIMEDOUT. On loopback the kernel answers
// the probes and socat's outbound leg carries no keepalive (#246).
const OLLAMA_RELAY_URL = 'http://127.0.0.1:11434';
// Tools OpenClaw exposes to Ollama models. Direct schemas (no Tool Search) are
// required: an 8B model cannot drive tool_search -> tool_call and loops on the
// wrapper instead (#247). The trimmed "coding" set keeps the prompt near 10K
// tokens, which halves the first reply and keeps turns clear of budget
// compaction; the denied tools cannot work here anyway (no provider keys for
// web/x search, no vision model, no code-execution sandbox).
const OLLAMA_TOOL_POLICY = {
  profile: 'coding',
  deny: [
    'group:sessions',
    'cron',
    'get_goal',
    'create_goal',
    'update_goal',
    'progress_card',
    'skill_workshop',
    'image_generate',
    'music_generate',
    'video_generate',
    'web_search',
    'x_search',
    'view_image',
    'code_execution',
  ],
};
// Whole-run budget. A new session on a laptop spends ~1-2 minutes on the first
// model call alone, so a multi-step tool task does not fit in 300s.
const OLLAMA_AGENT_TIMEOUT_SECONDS = 900;
const OLLAMA_WARMUP_TIMEOUT_SECONDS_DEFAULT = 120;
const EXEC_MODE_PRESETS = {
  safer: 'cautious',
  full: 'yolo',
};

function resolvedPath(value) {
  return path.resolve(String(value || ''));
}

function readJson(file) {
  const resolved = resolvedPath(file);
  if (!fs.existsSync(resolved)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function writeJson(file, data, backup) {
  const resolved = resolvedPath(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (backup && fs.existsSync(resolved)) {
    fs.copyFileSync(resolved, resolved + '.bak');
  }
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2) + '\n');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function runOpenclaw(args, input) {
  const result = spawnSync(OPENCLAW_BIN, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const label = 'openclaw ' + args.slice(0, 3).join(' ');
  if (result.error) {
    throw new Error(label + ' could not run: ' + result.error.message);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim().split('\n').pop();
    throw new Error(label + ' exited ' + result.status + (detail ? ': ' + detail : ''));
  }
  return String(result.stdout || '');
}

// OpenClaw may print diagnostics (for example "[config] warnings: ...") ahead of
// the JSON document on stdout, so parse from the first line that opens one.
function parseJsonOutput(stdout, label) {
  const text = String(stdout || '');
  const starts = [0];
  const pattern = /\n(?=[[{])/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    starts.push(match.index + 1);
  }
  for (const start of starts) {
    try {
      return JSON.parse(text.slice(start));
    } catch (error) {
      // Try the next candidate start.
    }
  }
  throw new Error(label + ' did not return JSON');
}

// Resolve the Ollama context window size (num_ctx) for the model entry.
// Defaults to OLLAMA_NUM_CTX_DEFAULT rather than being omitted. Omitting it
// lets Ollama apply its own default, which is NOT derived from available VRAM
// as previously assumed (#189): it is a small fixed value — measured at 4096
// for qwen3:8b on an M4/24GB host, against an advertised context of 40960.
// 4096 cannot carry an agent turn. OpenClaw's provider docs put the floor at
// 16K-24K because system prompt, tool definitions and history consume 8-12k
// before the model reasons at all; at 4096 the workspace bootstrap is
// truncated, the model hallucinates rather than reading, and the turn ends in
// `empty response detected` (#213).
//
// 24576 is the top of that documented band, chosen by measurement rather than
// by picking the safest-looking number: at 16384 the same agent turn still
// failed (the model wandered off the task instead of completing it), while
// 24576 completed it correctly on two consecutive runs. It also stays clear of
// the opposite failure, which is equally real: a 27.9B model at a forced 32768
// returned nothing in 10 minutes. Large models on
// constrained hosts should lower this via OPENCLAW_OLLAMA_NUM_CTX rather than
// have the default lowered for everyone back into the range that does not work.
//
// Overridable in both directions via OPENCLAW_OLLAMA_NUM_CTX, which must parse
// to a positive finite integer; unset, blank, or invalid values fall back to
// the default.
const OLLAMA_NUM_CTX_DEFAULT = 24576;

function resolveOllamaNumCtx() {
  const raw = process.env.OPENCLAW_OLLAMA_NUM_CTX;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return OLLAMA_NUM_CTX_DEFAULT;
}

// Resolve whether Ollama "thinking" (reasoning trace) is enabled for the model
// entry. `reasoning: false` on the model entry does NOT disable Ollama
// thinking; OpenClaw's native Ollama adapter only reads params.think ??
// params.thinking and promotes it to Ollama's top-level `think` request field.
// Without it, the model's reasoning monologue leaks into the visible reply.
// Default is thinking OFF; set OPENCLAW_OLLAMA_THINKING to turn it back on
// (rollback switch) if a model needs its native thinking behavior restored.
function resolveOllamaThinking() {
  const raw = process.env.OPENCLAW_OLLAMA_THINKING;
  if (typeof raw !== 'string') {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function buildOllamaAuthConfigProfile() {
  return {
    provider: 'ollama',
    mode: 'api_key',
  };
}

function gatewayToken() {
  const config = readJson(OPENCLAW_CONFIG_PATH);
  const gateway = isObject(config.gateway) ? config.gateway : {};
  const auth = isObject(gateway.auth) ? gateway.auth : {};
  process.stdout.write(typeof auth.token === 'string' ? auth.token : '');
}

// Report the exec policy OpenClaw actually enforces (requested config
// intersected with host approvals), not what files say. With nothing
// configured OpenClaw enforces security=full / ask=off, so reading files and
// defaulting to "safer" misreported every fresh install (#245).
function execModeRead() {
  const report = parseJsonOutput(runOpenclaw(['exec-policy', 'show', '--json']), 'openclaw exec-policy show');
  const policy = isObject(report) && isObject(report.effectivePolicy) ? report.effectivePolicy : {};
  const scope = Array.isArray(policy.scopes) && isObject(policy.scopes[0]) ? policy.scopes[0] : {};
  const effective = (field) =>
    isObject(scope[field]) && typeof scope[field].effective === 'string' ? scope[field].effective : null;
  const result = {
    security: effective('security'),
    ask: effective('ask'),
    askFallback: effective('askFallback'),
  };
  if (!result.security || !result.ask) {
    throw new Error('openclaw exec-policy show did not report an effective security/ask policy');
  }
  process.stdout.write(JSON.stringify(result));
}

// Safer and Full access map exactly onto OpenClaw's built-in presets:
// cautious = allowlist / on-miss / deny, yolo = full / off / full.
function execModeWrite(mode) {
  const preset = EXEC_MODE_PRESETS[mode];
  if (!preset) {
    throw new Error('exec-mode-write requires safer or full');
  }
  runOpenclaw(['exec-policy', 'preset', preset, '--json']);
}

function ollamaConfigWrite(model) {
  const selectedModel = String(model || '').trim();
  if (!selectedModel) {
    throw new Error('ollama-config-write requires a model');
  }

  const config = readJson(OPENCLAW_CONFIG_PATH);
  config.agents = isObject(config.agents) ? config.agents : {};
  config.agents.defaults = isObject(config.agents.defaults) ? config.agents.defaults : {};
  config.agents.defaults.model = isObject(config.agents.defaults.model) ? config.agents.defaults.model : {};
  config.agents.defaults.model.primary = 'ollama/' + selectedModel;
  config.agents.defaults.timeoutSeconds = OLLAMA_AGENT_TIMEOUT_SECONDS;
  // Enable local-model-lean for the Ollama path unless the user has already
  // set it explicitly (including to `false`). It trims optional tools such as
  // browser, automations and message from local runs. It is a small prompt
  // saving on top of the tool policy below, not the fix for slow first turns:
  // those were the keepalive cut (#246) and the tool surface (#247). This must
  // be a presence check, not a truthiness check: an explicit `false` counts as
  // present and must be preserved across re-applies.
  config.agents.defaults.experimental = isObject(config.agents.defaults.experimental) ?
    config.agents.defaults.experimental : {};
  if (!Object.prototype.hasOwnProperty.call(config.agents.defaults.experimental, 'localModelLean')) {
    config.agents.defaults.experimental.localModelLean = true;
  }
  // Local routes default to Tool Search, which hides exec/read/write behind
  // tool_search/tool_call; cloud routes already use direct tools, so turning it
  // off only changes local runs. byProvider scopes the trimmed set to Ollama.
  config.tools = isObject(config.tools) ? config.tools : {};
  config.tools.toolSearch = false;
  config.tools.byProvider = isObject(config.tools.byProvider) ? config.tools.byProvider : {};
  config.tools.byProvider.ollama = {
    profile: OLLAMA_TOOL_POLICY.profile,
    deny: OLLAMA_TOOL_POLICY.deny.slice(),
  };
  config.models = isObject(config.models) ? config.models : {};
  config.models.providers = isObject(config.models.providers) ? config.models.providers : {};
  // `reasoning` must track `thinking`: OpenClaw's native Ollama adapter
  // (shouldForwardNativeOllamaThink in extensions/ollama/src/stream.ts) only
  // forwards params.think/thinking to Ollama when think === false OR the
  // model's `reasoning` is not explicitly false. A model marked
  // `reasoning: false` with `params.thinking: true` would have its thinking
  // request silently dropped, making the OPENCLAW_OLLAMA_THINKING rollback
  // switch inert. Deriving both from one resolved value keeps them in sync.
  const thinking = resolveOllamaThinking();
  const numCtx = resolveOllamaNumCtx();
  const params = { thinking, num_ctx: numCtx };
  config.models.providers.ollama = {
    api: 'ollama',
    apiKey: OLLAMA_API_KEY,
    baseUrl: OLLAMA_RELAY_URL,
    models: [
      {
        id: selectedModel,
        name: selectedModel,
        reasoning: thinking,
        // contextTokens caps OpenClaw's active input budget; num_ctx sets the
        // native Ollama request context. The provider docs require these be
        // kept aligned when the host cannot serve the model's full advertised
        // context, which is the normal case on the hardware this extension
        // targets. Setting num_ctx alone leaves OpenClaw budgeting against a
        // window Ollama will not actually serve.
        contextTokens: numCtx,
        params,
      },
    ],
  };
  config.auth = isObject(config.auth) ? config.auth : {};
  config.auth.profiles = isObject(config.auth.profiles) ? config.auth.profiles : {};
  config.auth.profiles['ollama:manual'] = buildOllamaAuthConfigProfile();
  config.auth.order = isObject(config.auth.order) ? config.auth.order : {};
  config.auth.order.ollama = ['ollama:manual'];

  writeJson(OPENCLAW_CONFIG_PATH, config, true);
}

// Agent ids as OpenClaw reports them. `main` is always included so a fresh
// install, or a CLI that cannot list agents yet, still gets a working default.
function listAgentIds() {
  const ids = new Set([MAIN_AGENT_ID]);
  let agents;
  try {
    agents = parseJsonOutput(runOpenclaw(['agents', 'list', '--json']), 'openclaw agents list');
  } catch (error) {
    process.stderr.write('could not list agents, configuring main only: ' + error.message + '\n');
    return Array.from(ids);
  }
  if (Array.isArray(agents)) {
    for (const agent of agents) {
      if (isObject(agent) && typeof agent.id === 'string' && /^[A-Za-z0-9_-]+$/.test(agent.id)) {
        ids.add(agent.id);
      }
    }
  }
  return Array.from(ids);
}

// Register the local Ollama key through OpenClaw's own auth store (SQLite in
// 2026.9.3). The resulting profile id is `ollama:manual`, matching the
// auth.profiles/auth.order entries ollama-config-write puts in openclaw.json.
function ollamaAuthWrite() {
  for (const id of listAgentIds()) {
    runOpenclaw(['models', 'auth', 'paste-api-key', '--provider', 'ollama', '--agent', id], OLLAMA_API_KEY + '\n');
  }
}

// Preload a model into host Ollama (POST /api/generate with no prompt and a
// keep_alive is Ollama's documented preload). The UI used to run curl through
// the Docker Desktop SDK, which re-splits arguments and mangled the JSON body
// (#241); running here keeps the argv free of spaces and quotes.
//
// Error wording is load-bearing for the UI's probe classifier: a timeout says
// "timed out" (a slow cold load is a warning), while an HTTP failure says
// "returned error" so Ollama's own "timed out waiting for llama runner" text
// in the body is still reported as a broken load (OLM-006).
async function ollamaWarmup(model, timeoutArg) {
  const selectedModel = String(model || '').trim();
  if (!selectedModel) {
    throw new Error('ollama-warmup requires a model');
  }
  const parsedTimeout = Number.parseInt(String(timeoutArg || ''), 10);
  const timeoutSeconds = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ?
    parsedTimeout : OLLAMA_WARMUP_TIMEOUT_SECONDS_DEFAULT;
  const url = (process.env.OLLAMA_WARMUP_URL || OLLAMA_RELAY_URL) + '/api/generate';

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, keep_alive: '30m' }),
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    });
  } catch (error) {
    if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('ollama-warmup timed out after ' + timeoutSeconds + 's loading ' + selectedModel);
    }
    const cause = error && error.cause && error.cause.message ? error.cause.message : (error && error.message) || String(error);
    throw new Error('ollama-warmup could not reach Ollama at ' + url + ': ' + cause);
  }
  if (!response.ok) {
    const body = (await response.text().catch(() => '')).trim().slice(0, 300);
    throw new Error('ollama-warmup: Ollama returned error HTTP ' + response.status + (body ? ': ' + body : ''));
  }
  await response.text().catch(() => '');
}

async function main(command, args) {
  if (command === 'gateway-token') {
    gatewayToken();
  } else if (command === 'exec-mode-read') {
    execModeRead();
  } else if (command === 'exec-mode-write') {
    execModeWrite(args[0]);
  } else if (command === 'ollama-config-write') {
    ollamaConfigWrite(args[0]);
  } else if (command === 'ollama-auth-write') {
    ollamaAuthWrite();
  } else if (command === 'ollama-warmup') {
    await ollamaWarmup(args[0], args[1]);
  } else {
    throw new Error('Unknown command: ' + command);
  }
}

main(process.argv[2], process.argv.slice(3)).catch((error) => {
  process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
  process.exit(1);
});
