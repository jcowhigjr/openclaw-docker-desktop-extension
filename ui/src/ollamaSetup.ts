// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export type OllamaModel = {
  name: string;
  size?: number;
};

export type JsonObject = Record<string, unknown>;

const DEFAULT_OLLAMA_BASE_URL = 'http://host.docker.internal:11434';

type OllamaTagsResponse = {
  models?: Array<{
    name?: unknown;
    model?: unknown;
    size?: unknown;
  }>;
};

// Result of parsing an Ollama /api/tags body. A valid response with zero
// models (`ok: true, models: []`) is deliberately distinct from a missing body
// (`reason: 'empty'`) or an unparseable/wrong-shape body (`reason: 'invalid'`),
// so callers can avoid reporting a corrupt response as "no models installed".
export type OllamaTagsResult =
  | { ok: true; models: OllamaModel[] }
  | { ok: false; reason: 'empty' | 'invalid' };

export function parseOllamaTags(stdout: string): OllamaTagsResult {
  if (!stdout.trim()) {
    return { ok: false, reason: 'empty' };
  }

  let payload: OllamaTagsResponse;
  try {
    payload = JSON.parse(stdout) as OllamaTagsResponse;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (!Array.isArray(payload.models)) {
    return { ok: false, reason: 'invalid' };
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

  return { ok: true, models };
}

export function buildOllamaTagsFetchArgs(): string[] {
  return [
    'curl',
    '-fsS',
    '--max-time',
    '5',
    `${DEFAULT_OLLAMA_BASE_URL}/api/tags`,
  ];
}

// Build Docker SDK-safe argv that preloads a model into host Ollama. A POST to
// /api/generate with no prompt and a keep_alive triggers Ollama's documented
// model-preload: it loads the model into memory and returns immediately. Firing
// this after a restart means the user's first real message does not pay the
// cold-load cost (which otherwise shows up as an "LLM request timed out").
// Returns [] for a blank model so callers can skip the warmup safely.
// `timeoutSeconds` defaults to the existing 120s restart-time warmup budget;
// callers with a tighter budget (e.g. a detect-time load probe) can override it.
export function buildOllamaWarmupArgs(model: string, timeoutSeconds = 120): string[] {
  const trimmed = model.trim();
  if (!trimmed) {
    return [];
  }

  const body = JSON.stringify({ model: trimmed, keep_alive: '30m' });
  return [
    'curl',
    '-fsS',
    '--max-time',
    String(timeoutSeconds),
    '-X',
    'POST',
    '-H',
    'Content-Type: application/json',
    '-d',
    body,
    `${DEFAULT_OLLAMA_BASE_URL}/api/generate`,
  ];
}

// Auto-select the smallest installed model, since local disk space and model
// turnover mean there is no stable name to hardcode, and Ollama exposes no
// endpoint that reports the host's VRAM budget for a "largest that fits"
// choice (see issue #190). Models with a known `size` always outrank models
// without one, so an unreported size is never mistaken for "small". Ties on
// identical size resolve by model name so selection is deterministic.
export function chooseRecommendedOllamaModel(models: OllamaModel[]): string {
  const sized = models.filter((model) => typeof model.size === 'number' && Number.isFinite(model.size));

  if (sized.length === 0) {
    return models[0]?.name ?? '';
  }

  const [smallest] = [...sized].sort((a, b) => {
    if (a.size !== b.size) {
      return (a.size as number) - (b.size as number);
    }
    return a.name.localeCompare(b.name);
  });

  return smallest?.name ?? '';
}

// Pure formatter for showing an installed model's size in the picker, e.g.
// "2.5 GB". Returns '' for anything that isn't a usable positive size so
// callers can render the model name alone with no trailing separator.
export function formatOllamaModelSize(bytes: number | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }

  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export function normalizeOllamaModelName(model: string): string {
  const trimmed = model.trim();
  return trimmed.startsWith('ollama/') ? trimmed.slice('ollama/'.length) : trimmed;
}

// `openclaw config get` exits non-zero with this message when the requested path
// is not set yet (fresh install with no model configured). That is an expected
// state, not an Ollama reachability failure.
export function isConfigPathMissing(text: string): boolean {
  return text.toLowerCase().includes('config path not found');
}
