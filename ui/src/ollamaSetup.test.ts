// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  buildOllamaAuthConfigProfile,
  buildOllamaAuthOrder,
  buildOllamaAuthProfilesStore,
  buildOllamaProviderPatch,
  buildOllamaTagsFetchArgs,
  chooseRecommendedOllamaModel,
  isConfigPathMissing,
  mergeOllamaProviderConfig,
  normalizeOllamaModelName,
  parseOllamaTags,
} from './ollamaSetup';

describe('ollamaSetup helpers', () => {
  it('parses installed Ollama models from the host tags API', () => {
    const result = parseOllamaTags(
      JSON.stringify({
        models: [
          { name: 'qwen3.5:latest', size: 6594474711 },
          { model: 'gemma4-fast:latest', size: 9608350718 },
          { name: '', size: 1 },
        ],
      }),
    );

    expect(result).toEqual({
      ok: true,
      models: [
        { name: 'qwen3.5:latest', size: 6594474711 },
        { name: 'gemma4-fast:latest', size: 9608350718 },
      ],
    });
  });

  it('treats a valid response with zero models as a successful empty list', () => {
    expect(parseOllamaTags(JSON.stringify({ models: [] }))).toEqual({ ok: true, models: [] });
  });

  it('flags an unparseable tags body as invalid, distinct from an empty list', () => {
    expect(parseOllamaTags('<html>not json</html>')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseOllamaTags('ollama request timed out')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseOllamaTags(JSON.stringify({ models: 'nope' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseOllamaTags('\uFEFF{}')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseOllamaTags('{"models": [')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('flags an empty tags body distinctly from a parse failure', () => {
    expect(parseOllamaTags('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseOllamaTags('   \n')).toEqual({ ok: false, reason: 'empty' });
  });

  it('detects an unset config path from openclaw config get output', () => {
    expect(isConfigPathMissing('Config path not found: agents.defaults.model.primary')).toBe(true);
    expect(isConfigPathMissing('  Config path not found: agents.defaults.model.primary\n')).toBe(true);
  });

  it('matches the config-path-missing message regardless of casing', () => {
    expect(isConfigPathMissing('config path not found: agents.defaults.model.primary')).toBe(true);
    expect(isConfigPathMissing('Error: CONFIG PATH NOT FOUND')).toBe(true);
  });

  it('does not treat a configured model or empty output as a missing path', () => {
    expect(isConfigPathMissing('ollama/qwen3.5:latest')).toBe(false);
    expect(isConfigPathMissing('')).toBe(false);
    expect(isConfigPathMissing('some unrelated error')).toBe(false);
  });

  it('keeps an unconfigured model name empty when normalized', () => {
    expect(normalizeOllamaModelName('')).toBe('');
  });

  it('builds a native Ollama provider patch for OpenClaw', () => {
    expect(buildOllamaProviderPatch('qwen3.5:latest')).toEqual({
      agents: {
        defaults: {
          model: {
            primary: 'ollama/qwen3.5:latest',
          },
          timeoutSeconds: 300,
        },
      },
      models: {
        providers: {
          ollama: {
            api: 'ollama',
            apiKey: 'ollama-local',
            baseUrl: 'http://host.docker.internal:11434',
            models: [
              {
                id: 'qwen3.5:latest',
                name: 'qwen3.5:latest',
                reasoning: false,
              },
            ],
          },
        },
      },
    });
  });

  it('builds the per-agent Ollama auth store profile', () => {
    expect(buildOllamaAuthConfigProfile()).toEqual({
      provider: 'ollama',
      mode: 'api_key',
    });
    expect(buildOllamaAuthProfilesStore()).toEqual({
      version: 1,
      profiles: {
        'ollama:manual': {
          type: 'api_key',
          provider: 'ollama',
          key: 'ollama-local',
        },
      },
    });
    expect(buildOllamaAuthOrder()).toEqual(['ollama:manual']);
  });

  it('builds Docker SDK-safe argv for fetching host Ollama tags', () => {
    expect(buildOllamaTagsFetchArgs()).toEqual([
      'curl',
      '-fsS',
      '--max-time',
      '5',
      'http://host.docker.internal:11434/api/tags',
    ]);
  });

  it('prefers a practical installed local model over the first Ollama result', () => {
    expect(
      chooseRecommendedOllamaModel([
        { name: 'batiai/qwen3.6-35b:iq4' },
        { name: 'qwen3.5:latest' },
        { name: 'gemma4:latest' },
      ]),
    ).toBe('gemma4:latest');

    expect(
      chooseRecommendedOllamaModel([
        { name: 'batiai/qwen3.6-35b:iq4' },
        { name: 'qwen3.5:latest' },
      ]),
    ).toBe('qwen3.5:latest');
  });

  it('normalizes configured Ollama model ids for selection comparison', () => {
    expect(normalizeOllamaModelName('ollama/gemma4:latest')).toBe('gemma4:latest');
    expect(normalizeOllamaModelName('gemma4:latest')).toBe('gemma4:latest');
    expect(normalizeOllamaModelName('  ollama/qwen3.5:latest  ')).toBe('qwen3.5:latest');
  });

  it('merges Ollama provider config without clobbering existing gateway auth or other providers', () => {
    const merged = mergeOllamaProviderConfig(
      {
        gateway: {
          auth: {
            mode: 'token',
            token: 'preserved-token',
          },
        },
        auth: {
          profiles: {
            'anthropic:default': {
              provider: 'anthropic',
              mode: 'api_key',
            },
          },
          order: {
            anthropic: ['anthropic:default'],
          },
        },
        models: {
          providers: {
            anthropic: {
              api: 'anthropic',
              apiKey: 'existing-secret-ref',
            },
          },
        },
      },
      'qwen3.5:latest',
    ) as any;

    expect(merged.gateway.auth.token).toBe('preserved-token');
    expect(merged.agents.defaults.model.primary).toBe('ollama/qwen3.5:latest');
    expect(merged.agents.defaults.timeoutSeconds).toBe(300);
    expect(merged.auth.profiles['anthropic:default']).toEqual({
      provider: 'anthropic',
      mode: 'api_key',
    });
    expect(merged.auth.profiles['ollama:manual']).toEqual({
      provider: 'ollama',
      mode: 'api_key',
    });
    expect(merged.auth.order.anthropic).toEqual(['anthropic:default']);
    expect(merged.auth.order.ollama).toEqual(['ollama:manual']);
    expect(merged.models.providers.anthropic.api).toBe('anthropic');
    expect(merged.models.providers.ollama).toEqual({
      api: 'ollama',
      apiKey: 'ollama-local',
      baseUrl: 'http://host.docker.internal:11434',
      models: [
        {
          id: 'qwen3.5:latest',
          name: 'qwen3.5:latest',
          reasoning: false,
        },
      ],
    });
  });
});
