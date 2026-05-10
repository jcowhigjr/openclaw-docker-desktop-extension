import { describe, expect, it } from 'vitest';

import {
  buildOllamaProviderPatch,
  chooseRecommendedOllamaModel,
  mergeOllamaProviderConfig,
  normalizeOllamaModelName,
  parseOllamaTags,
} from './ollamaSetup';

describe('ollamaSetup helpers', () => {
  it('parses installed Ollama models from the host tags API', () => {
    const models = parseOllamaTags(
      JSON.stringify({
        models: [
          { name: 'qwen3.5:latest', size: 6594474711 },
          { model: 'gemma4-fast:latest', size: 9608350718 },
          { name: '', size: 1 },
        ],
      }),
    );

    expect(models).toEqual([
      { name: 'qwen3.5:latest', size: 6594474711 },
      { name: 'gemma4-fast:latest', size: 9608350718 },
    ]);
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
