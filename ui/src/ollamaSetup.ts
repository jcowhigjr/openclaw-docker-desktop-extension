export type OllamaModel = {
  name: string;
  size?: number;
};

export type JsonObject = Record<string, unknown>;

const DEFAULT_OLLAMA_BASE_URL = 'http://host.docker.internal:11434';
const DEFAULT_OLLAMA_API_KEY = 'ollama-local';
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

  const payload = JSON.parse(stdout) as OllamaTagsResponse;
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
  const existingAgents = isJsonObject(existing.agents) ? existing.agents : {};
  const existingAgentDefaults = isJsonObject(existingAgents.defaults) ? existingAgents.defaults : {};
  const patchAgents = patch.agents as JsonObject;
  const patchAgentDefaults = patchAgents.defaults as JsonObject;
  const existingModels = isJsonObject(existing.models) ? existing.models : {};
  const existingProviders = isJsonObject(existingModels.providers) ? existingModels.providers : {};
  const patchModels = patch.models as JsonObject;
  const patchProviders = patchModels.providers as JsonObject;

  return {
    ...existing,
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
