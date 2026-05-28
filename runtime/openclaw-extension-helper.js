#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.

const fs = require('fs');
const path = require('path');

const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/home/node/.openclaw/openclaw.json';
const EXEC_APPROVALS_PATH = process.env.EXEC_APPROVALS_PATH || '/home/node/.openclaw/exec-approvals.json';
const OPENCLAW_AUTH_PROFILES_PATH =
  process.env.OPENCLAW_AUTH_PROFILES_PATH || '/home/node/.openclaw/agents/main/agent/auth-profiles.json';

function readJson(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data, backup) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (backup && fs.existsSync(file)) {
    fs.copyFileSync(file, file + '.bak');
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
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
  config.models = isObject(config.models) ? config.models : {};
  config.models.providers = isObject(config.models.providers) ? config.models.providers : {};
  config.models.providers.ollama = {
    api: 'ollama',
    apiKey: 'ollama-local',
    baseUrl: 'http://host.docker.internal:11434',
    models: [
      {
        id: selectedModel,
        name: selectedModel,
        reasoning: false,
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

function ollamaAuthProfilesWrite() {
  writeJson(OPENCLAW_AUTH_PROFILES_PATH, {
    version: 1,
    profiles: {
      'ollama:manual': {
        type: 'api_key',
        provider: 'ollama',
        key: 'ollama-local',
      },
    },
  }, false);
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
