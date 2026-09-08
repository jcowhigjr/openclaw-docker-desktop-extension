#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.

const fs = require('fs');
const path = require('path');

const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/home/node/.openclaw/openclaw.json';
const EXEC_APPROVALS_PATH = process.env.EXEC_APPROVALS_PATH || '/home/node/.openclaw/exec-approvals.json';
// Explicit single-file override (kept for back-compat / tests). When set, the
// Ollama auth profile is written only to this path.
const OPENCLAW_AUTH_PROFILES_OVERRIDE = process.env.OPENCLAW_AUTH_PROFILES_PATH || null;
// Base directory holding per-agent dirs (<agents>/<id>/agent/auth-profiles.json).
// OpenClaw resolves auth per-agent, so the profile must reach every agent.
const OPENCLAW_AGENTS_DIR = process.env.OPENCLAW_AGENTS_DIR || '/home/node/.openclaw/agents';
const MAIN_AGENT_ID = 'main';

const OLLAMA_AUTH_PROFILE = {
  type: 'api_key',
  provider: 'ollama',
  key: 'ollama-local',
};

function resolvedPath(value) {
  return path.resolve(String(value || ''));
}

function isSafePathSegment(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !path.isAbsolute(value);
}

function safeJoin(base, ...segments) {
  const root = resolvedPath(base);
  const cleanSegments = segments.map((segment) => {
    if (!isSafePathSegment(segment)) {
      throw new Error('unsafe path segment: ' + segment);
    }
    return segment;
  });
  const target = path.resolve(root, ...cleanSegments);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith('..' + path.sep)) {
    throw new Error('resolved path escapes base directory');
  }
  return target;
}

function authProfilesPath(file) {
  const resolved = resolvedPath(file);
  if (path.basename(resolved) !== 'auth-profiles.json') {
    throw new Error('auth profile path must end with auth-profiles.json');
  }
  return resolved;
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

function executionModeConfig(mode) {
  if (mode === 'full') {
    return {
      approvalsDefaults: {
        security: 'full',
        ask: 'off',
        askFallback: 'full',
        autoAllowSkills: false,
      },
      toolsExec: {
        host: 'gateway',
        security: 'full',
        ask: 'off',
      },
    };
  }

  return {
    approvalsDefaults: {
      security: 'allowlist',
      ask: 'on-miss',
      askFallback: 'deny',
      autoAllowSkills: false,
    },
    toolsExec: {
      host: 'gateway',
      security: 'allowlist',
      ask: 'on-miss',
    },
  };
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
// returned nothing in 10 minutes, past the 120s idle watchdog. Large models on
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

function execModeRead() {
  const approvals = readJson(EXEC_APPROVALS_PATH);
  const config = readJson(OPENCLAW_CONFIG_PATH);
  const defaults = isObject(approvals.defaults) ? approvals.defaults : {};
  const tools = isObject(config.tools) ? config.tools : {};
  const exec = isObject(tools.exec) ? tools.exec : {};

  process.stdout.write(JSON.stringify({
    approvals: { defaults },
    config: { tools: { exec } },
  }));
}

function execModeWrite(mode) {
  if (mode !== 'safer' && mode !== 'full') {
    throw new Error('exec-mode-write requires safer or full');
  }

  const next = executionModeConfig(mode);
  const approvals = readJson(EXEC_APPROVALS_PATH);
  const config = readJson(OPENCLAW_CONFIG_PATH);

  approvals.version = 1;
  approvals.defaults = Object.assign({}, isObject(approvals.defaults) ? approvals.defaults : {}, next.approvalsDefaults);
  config.tools = isObject(config.tools) ? config.tools : {};
  config.tools.exec = Object.assign({}, isObject(config.tools.exec) ? config.tools.exec : {}, next.toolsExec);

  writeJson(EXEC_APPROVALS_PATH, approvals, true);
  writeJson(OPENCLAW_CONFIG_PATH, config, true);
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
  config.agents.defaults.timeoutSeconds = 300;
  // Enable local-model-lean unconditionally for the Ollama path, unless the
  // user has already set it explicitly (including to `false`). The Ollama
  // path is by definition the constrained-hardware path, and lean mode's
  // substantive benefit — routing tool exposure through toolSearch instead
  // of listing the full catalogue in the system prompt — materially shrinks
  // the ~20k-token prompt-eval cost that trips OpenClaw's 120s idle
  // watchdog on slow local models. This must be a presence check, not a
  // truthiness check: an explicit `false` counts as present and must be
  // preserved across re-applies, or a deliberate opt-out would silently
  // flip back to `true` every time a model is re-applied. No env override —
  // the presence check is the escape hatch.
  config.agents.defaults.experimental = isObject(config.agents.defaults.experimental) ?
    config.agents.defaults.experimental : {};
  if (!Object.prototype.hasOwnProperty.call(config.agents.defaults.experimental, 'localModelLean')) {
    config.agents.defaults.experimental.localModelLean = true;
  }
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
    apiKey: 'ollama-local',
    baseUrl: 'http://host.docker.internal:11434',
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

// Enumerate agent ids under the agents base. Always includes `main` as a floor.
// Other entries count as agents only if they are directories containing an
// `agent/` subdir, so stray files/dirs are skipped. Missing/unreadable base
// degrades to just `main`.
function listAgentIds(base) {
  const ids = new Set([MAIN_AGENT_ID]);
  const root = resolvedPath(base);
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return Array.from(ids);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafePathSegment(entry.name)) {
      continue;
    }
    if (fs.existsSync(safeJoin(root, entry.name, 'agent'))) {
      ids.add(entry.name);
    }
  }
  return Array.from(ids);
}

// Merge the ollama:manual profile into an agent's auth-profiles.json without
// clobbering other profiles. Idempotent. A malformed existing file is fatal for
// `main` (strong signal for the primary agent) but recoverable for others.
function mergeOllamaProfile(file, strict) {
  const resolvedFile = authProfilesPath(file);
  let data;
  try {
    data = readJson(resolvedFile);
  } catch (error) {
    if (strict) {
      throw error;
    }
    process.stderr.write('skipping malformed auth-profiles.json at ' + resolvedFile + ': ' +
      (error && error.message ? error.message : String(error)) + '\n');
    data = {};
  }
  if (!isObject(data)) {
    data = {};
  }
  if (typeof data.version !== 'number') {
    data.version = 1;
  }
  if (!isObject(data.profiles)) {
    data.profiles = {};
  }
  data.profiles['ollama:manual'] = Object.assign({}, OLLAMA_AUTH_PROFILE);
  writeJson(resolvedFile, data, false);
}

function ollamaAuthProfilesWrite() {
  if (OPENCLAW_AUTH_PROFILES_OVERRIDE) {
    mergeOllamaProfile(OPENCLAW_AUTH_PROFILES_OVERRIDE, true);
    return;
  }
  for (const id of listAgentIds(OPENCLAW_AGENTS_DIR)) {
    const file = safeJoin(OPENCLAW_AGENTS_DIR, id, 'agent', 'auth-profiles.json');
    mergeOllamaProfile(file, id === MAIN_AGENT_ID);
  }
}

const command = process.argv[2];
const args = process.argv.slice(3);

try {
  if (command === 'gateway-token') {
    gatewayToken();
  } else if (command === 'exec-mode-read') {
    execModeRead();
  } else if (command === 'exec-mode-write') {
    execModeWrite(args[0]);
  } else if (command === 'ollama-config-write') {
    ollamaConfigWrite(args[0]);
  } else if (command === 'ollama-auth-profiles-write') {
    ollamaAuthProfilesWrite();
  } else {
    throw new Error('Unknown command: ' + command);
  }
} catch (error) {
  process.stderr.write((error && error.message ? error.message : String(error)) + '\n');
  process.exit(1);
}
