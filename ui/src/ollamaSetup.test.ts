// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  buildOllamaTagsFetchArgs,
  buildOllamaWarmupArgs,
  chooseRecommendedOllamaModel,
  formatOllamaModelSize,
  isConfigPathMissing,
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

  it('builds Docker SDK-safe argv for fetching host Ollama tags', () => {
    expect(buildOllamaTagsFetchArgs()).toEqual([
      'curl',
      '-fsS',
      '--max-time',
      '5',
      'http://host.docker.internal:11434/api/tags',
    ]);
  });

  it('builds Docker SDK-safe argv that preloads a model into host Ollama', () => {
    expect(buildOllamaWarmupArgs('gemma4-fast:latest')).toEqual([
      'curl',
      '-fsS',
      '--max-time',
      '120',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      '{"model":"gemma4-fast:latest","keep_alive":"30m"}',
      'http://host.docker.internal:11434/api/generate',
    ]);
  });

  it('trims the model name when building warmup argv and rejects empty', () => {
    expect(buildOllamaWarmupArgs('  qwen3.5:latest  ')[9]).toBe(
      '{"model":"qwen3.5:latest","keep_alive":"30m"}',
    );
    expect(buildOllamaWarmupArgs('   ')).toEqual([]);
  });

  it('defaults the warmup timeout to 120s but honors an explicit override for callers like a detect-time probe', () => {
    expect(buildOllamaWarmupArgs('gemma4-fast:latest')).toEqual([
      'curl',
      '-fsS',
      '--max-time',
      '120',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      '{"model":"gemma4-fast:latest","keep_alive":"30m"}',
      'http://host.docker.internal:11434/api/generate',
    ]);

    expect(buildOllamaWarmupArgs('gemma4-fast:latest', 20)[3]).toBe('20');
  });

  it('selects the smallest installed model over a larger, more recently modified one', () => {
    // Real shapes from the #190 bug report: an 18.2 GB model landed first in
    // /api/tags (most recently modified) while a working 2.5 GB model sat
    // unused. Size, not list position, must win.
    expect(
      chooseRecommendedOllamaModel([
        { name: 'muse-glimmer:30b-q4_K_M', size: 18_200_000_000 },
        { name: 'qwen3:4b', size: 2_500_000_000 },
      ]),
    ).toBe('qwen3:4b');
  });

  it('prefers any sized model over an unsized one, regardless of list order', () => {
    expect(
      chooseRecommendedOllamaModel([
        { name: 'no-size-reported' },
        { name: 'huge-but-sized', size: 50_000_000_000 },
      ]),
    ).toBe('huge-but-sized');
  });

  it('breaks ties on identical size by model name ascending, for deterministic selection', () => {
    expect(
      chooseRecommendedOllamaModel([
        { name: 'zeta:latest', size: 4_000_000_000 },
        { name: 'alpha:latest', size: 4_000_000_000 },
        { name: 'mu:latest', size: 4_000_000_000 },
      ]),
    ).toBe('alpha:latest');
  });

  it('falls back to the first entry when no model reports a size', () => {
    expect(
      chooseRecommendedOllamaModel([
        { name: 'batiai/qwen3.6-35b:iq4' },
        { name: 'qwen3.5:latest' },
      ]),
    ).toBe('batiai/qwen3.6-35b:iq4');
  });

  it('returns an empty string for an empty model list', () => {
    expect(chooseRecommendedOllamaModel([])).toBe('');
  });

  it('selects sensibly for a model list containing none of the old hardcoded names', () => {
    expect(
      chooseRecommendedOllamaModel([
        { name: 'batiai/qwen3.6-35b:iq4', size: 20_000_000_000 },
        { name: 'muse-glimmer:30b-q4_K_M', size: 18_200_000_000 },
        { name: 'obscure-model:latest', size: 900_000_000 },
      ]),
    ).toBe('obscure-model:latest');
  });

  it('formats a model size in GB with one decimal place', () => {
    expect(formatOllamaModelSize(2_500_000_000)).toBe('2.5 GB');
    expect(formatOllamaModelSize(18_200_000_000)).toBe('18.2 GB');
    expect(formatOllamaModelSize(0)).toBe('0.0 GB');
  });

  it('returns an empty string for a size that cannot be shown', () => {
    expect(formatOllamaModelSize(undefined)).toBe('');
    expect(formatOllamaModelSize(Number.NaN)).toBe('');
    expect(formatOllamaModelSize(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatOllamaModelSize(-1)).toBe('');
  });

  it('normalizes configured Ollama model ids for selection comparison', () => {
    expect(normalizeOllamaModelName('ollama/gemma4:latest')).toBe('gemma4:latest');
    expect(normalizeOllamaModelName('gemma4:latest')).toBe('gemma4:latest');
    expect(normalizeOllamaModelName('  ollama/qwen3.5:latest  ')).toBe('qwen3.5:latest');
  });
});
