export type OllamaModel = {
  name: string;
  size?: number;
};

export type JsonObject = Record<string, unknown>;

const DEFAULT_OLLAMA_BASE_URL = 'http://host.docker.internal:11434';
const DEFAULT_OLLAMA_API_KEY = 'ollama-local';
const OLLAMA_AUTH_PROFILE_ID = 'ollama:manual';
const OPENCLAW_CONFIG_PATH = '/home/node/.openclaw/openclaw.json';
const OPENCLAW_AUTH_PROFILES_PATH = '/home/node/.openclaw/agents/main/agent/auth-profiles.json';
const RECOMMENDED_MODEL_ORDER = [
  'gemma4:latest',
  'gemma4',
  'llama3.2:latest',
  'llama3.2',
  'qwen3.5:latest',
  'qwen3.5',
];

type OllamaTagsResponse = {
  models?: Array<{
    name?: unknown;
    model?: unknown;
    size?: unknown;
  }>;
};

export function parseOllamaTags(stdout: string): OllamaModel[] {
  if (!stdout.trim()) {
    return [];
  }

  let payload: OllamaTagsResponse;
  try {
    payload = JSON.parse(stdout) as OllamaTagsResponse;
  } catch {
    return [];
  }

  if (!Array.isArray(payload.models)) {
    return [];
  }

  const models: OllamaModel[] = [];
  for (const entry of payload.models) {
    const rawName = typeof entry.name === 'string' ? entry.name : entry.model;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) {
      continue;
    }

    const model: OllamaModel = { name };
    if (typeof entry.size === 'number' && Number.isFinite(entry.size)) {
      model.size = entry.size;
    }
    models.push(model);
  }

  return models;
}

export function buildOllamaProviderPatch(model: string): JsonObject {
  const selectedModel = model.trim();
  if (!selectedModel) {
    throw new Error('Choose an Ollama model before applying local setup.');
  }

  return {
    agents: {
      defaults: {
        model: {
          primary: `ollama/${selectedModel}`,
        },
        timeoutSeconds: 300,
      },
    },
    models: {
      providers: {
        ollama: {
          api: 'ollama',
          apiKey: DEFAULT_OLLAMA_API_KEY,
          baseUrl: DEFAULT_OLLAMA_BASE_URL,
          models: [
            {
              id: selectedModel,
              name: selectedModel,
              reasoning: false,
            },
          ],
        },
      },
    },
  };
}

export function buildOllamaAuthProfilesStore(): JsonObject {
  return {
    version: 1,
    profiles: {
      [OLLAMA_AUTH_PROFILE_ID]: {
        type: 'api_key',
        provider: 'ollama',
        key: DEFAULT_OLLAMA_API_KEY,
      },
    },
  };
}

export function buildOllamaAuthOrder(): string[] {
  return [OLLAMA_AUTH_PROFILE_ID];
}

export function buildOllamaTagsFetchScript(): string {
  return [
    'const http=require("http");',
    'const req=http.get("http://host.docker.internal:11434/api/tags",function(res){',
    'var data="";',
    'res.setEncoding("utf8");',
    'res.on("data",function(chunk){data=data+chunk;});',
    'res.on("end",function(){',
    'if(res.statusCode!==200){console.error("ollama returned "+res.statusCode);process.exit(1);}',
    'process.stdout.write(data);',
    '});',
    '});',
    'req.on("error",function(err){console.error(err.message);process.exit(1);});',
    'req.setTimeout(5000,function(){req.destroy(new Error("ollama request timed out"));});',
  ].join(' ');
}

export function buildOllamaConfigWriteScript(model: string): string {
  const selectedModel = model.trim();
  if (!selectedModel) {
    throw new Error('Choose an Ollama model before applying local setup.');
  }

  return [
    'const fs=require("fs");',
    'const configPath=' + JSON.stringify(OPENCLAW_CONFIG_PATH) + ';',
    'const model=' + JSON.stringify(selectedModel) + ';',
    'var config={};',
    'if(fs.existsSync(configPath)){config=JSON.parse(fs.readFileSync(configPath,"utf8"));}',
    'config.agents=config.agents||{};',
    'config.agents.defaults=config.agents.defaults||{};',
    'config.agents.defaults.model=config.agents.defaults.model||{};',
    'config.agents.defaults.model.primary="ollama/"+model;',
    'config.agents.defaults.timeoutSeconds=300;',
    'config.models=config.models||{};',
    'config.models.providers=config.models.providers||{};',
    'config.models.providers.ollama={api:"ollama",apiKey:"ollama-local",baseUrl:"http://host.docker.internal:11434",models:[{id:model,name:model,reasoning:false}]};',
    'config.auth=config.auth||{};',
    'config.auth.profiles=config.auth.profiles||{};',
    'config.auth.profiles["ollama:manual"]={provider:"ollama",mode:"api_key"};',
    'config.auth.order=config.auth.order||{};',
    'config.auth.order.ollama=["ollama:manual"];',
    'if(fs.existsSync(configPath)){fs.copyFileSync(configPath,configPath+".bak");}',
    'fs.writeFileSync(configPath,JSON.stringify(config,null,2)+"\\n");',
  ].join(' ');
}

export function buildOllamaAuthProfilesWriteScript(): string {
  return [
    'const fs=require("fs");',
    'const path=require("path");',
    'const file=' + JSON.stringify(OPENCLAW_AUTH_PROFILES_PATH) + ';',
    'const data=' + JSON.stringify(buildOllamaAuthProfilesStore()) + ';',
    'fs.mkdirSync(path.dirname(file),{recursive:true});',
    'fs.writeFileSync(file,JSON.stringify(data,null,2)+"\\n");',
  ].join(' ');
}

export function chooseRecommendedOllamaModel(models: OllamaModel[]): string {
  const installed = new Set(models.map((model) => model.name));
  for (const candidate of RECOMMENDED_MODEL_ORDER) {
    if (installed.has(candidate)) {
      return candidate;
    }
  }

  return models[0]?.name ?? '';
}

export function normalizeOllamaModelName(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith('ollama/') ? trimmed.slice('ollama/'.length) : trimmed;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeOllamaProviderConfig(existing: JsonObject, model: string): JsonObject {
  const patch = buildOllamaProviderPatch(model);
  const patchAuth = {
    profiles: buildOllamaAuthProfilesStore().profiles as JsonObject,
    order: {
      ollama: buildOllamaAuthOrder(),
    },
  };
  const existingAgents = isJsonObject(existing.agents) ? existing.agents : {};
  const existingAgentDefaults = isJsonObject(existingAgents.defaults) ? existingAgents.defaults : {};
  const existingAuth = isJsonObject(existing.auth) ? existing.auth : {};
  const existingAuthProfiles = isJsonObject(existingAuth.profiles) ? existingAuth.profiles : {};
  const existingAuthOrder = isJsonObject(existingAuth.order) ? existingAuth.order : {};
  const patchAgents = patch.agents as JsonObject;
  const patchAgentDefaults = patchAgents.defaults as JsonObject;
  const existingModels = isJsonObject(existing.models) ? existing.models : {};
  const existingProviders = isJsonObject(existingModels.providers) ? existingModels.providers : {};
  const patchModels = patch.models as JsonObject;
  const patchProviders = patchModels.providers as JsonObject;
  const patchAuthProfiles = patchAuth.profiles;
  const patchAuthOrder = patchAuth.order;

  return {
    ...existing,
    auth: {
      ...existingAuth,
      profiles: {
        ...existingAuthProfiles,
        ...patchAuthProfiles,
      },
      order: {
        ...existingAuthOrder,
        ...patchAuthOrder,
      },
    },
    agents: {
      ...existingAgents,
      defaults: {
        ...existingAgentDefaults,
        ...patchAgentDefaults,
      },
    },
    models: {
      ...existingModels,
      providers: {
        ...existingProviders,
        ...patchProviders,
      },
    },
  };
}
