// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { isConfigPathMissing, type OllamaTagsResult } from '../ollamaSetup';

export type DiagCode = 'OLM-001' | 'OLM-002' | 'OLM-003' | 'OLM-004' | 'OLM-005' | 'GEN-000';

type RegistryEntry = {
  title: string;
  remedy: string;
};

const REGISTRY: Record<DiagCode, RegistryEntry> = {
  'OLM-001': {
    title: 'No model configured yet',
    remedy: 'Expected on a fresh install. Pick a detected model and Apply.',
  },
  'OLM-002': {
    title: 'Configured-model read failed',
    remedy: 'Check the OpenClaw config volume; re-run Detect.',
  },
  'OLM-003': {
    title: 'Host Ollama unreachable',
    remedy: 'Start Ollama on the host (port 11434), then click Detect.',
  },
  'OLM-004': {
    title: 'Host Ollama returned an empty response',
    remedy: 'Confirm Ollama is serving the model API, then Detect.',
  },
  'OLM-005': {
    title: 'Host Ollama response unreadable',
    remedy: 'The /api/tags response was not a model list. Check the Ollama version, then Detect.',
  },
  'GEN-000': {
    title: 'Unexpected error',
    remedy: 'Copy diagnostics and open a GitHub issue with the bundle.',
  },
};

export type Classification = {
  code?: DiagCode;
  rawMessage: string;
};

export function classifyOllamaTags(result: OllamaTagsResult): Classification {
  if (result.ok) {
    return { code: undefined, rawMessage: '' };
  }
  return { code: result.reason === 'empty' ? 'OLM-004' : 'OLM-005', rawMessage: result.reason };
}

export function classifyError(context: string, rawMessage: string): { code: DiagCode; rawMessage: string } {
  if (context === 'ollama.config_get') {
    if (isConfigPathMissing(rawMessage)) {
      return { code: 'OLM-001', rawMessage };
    }
    return { code: 'OLM-002', rawMessage };
  }
  if (context === 'ollama.tags_fetch') {
    return { code: 'OLM-003', rawMessage };
  }
  return { code: 'GEN-000', rawMessage };
}

export function getRemedy(code: string): string {
  return REGISTRY[code as DiagCode]?.remedy ?? REGISTRY['GEN-000'].remedy;
}

export function getTitle(code: string): string {
  return REGISTRY[code as DiagCode]?.title ?? REGISTRY['GEN-000'].title;
}
