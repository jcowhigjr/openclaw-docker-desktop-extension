// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';

import { resetDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';
import { isOllamaWarmupArgs } from './ollamaSetup';

afterEach(() => resetDiagEvents());

type Responses = {
  tags: string;
  config?: string | Error;
  // A string means the probe resolves with that stdout body. An Error or a
  // plain object means the probe rejects with it -- production's real `run`
  // (ddClient.docker.cli.exec) rejects with a plain object, not an Error, so
  // both shapes need coverage here.
  probe?: string | Error | Record<string, unknown>;
};

// Failure text as the runtime helper's `ollama-warmup` reports it.
const REACH_FAILURE =
  'ollama-warmup could not reach Ollama at http://127.0.0.1:11434/api/generate: connect ECONNREFUSED 127.0.0.1:11434';
const TIMEOUT_FAILURE = 'ollama-warmup timed out after 20s loading qwen3.5:latest';

// Mirrors the real `run` call shape used by runDetect: a single command
// runner dispatched three different ways by which curl/CLI invocation it is
// asked to make. Distinguish calls by inspecting the argv, the same way the
// production code builds them.
function makeRun(responses: Responses) {
  return vi.fn(async (_cmd: string, args: string[]) => {
    const joined = args.join(' ');
    if (isOllamaWarmupArgs(args)) {
      if (responses.probe !== undefined && typeof responses.probe !== 'string') {
        throw responses.probe;
      }
      return { stdout: responses.probe ?? '{}' };
    }
    if (joined.includes('/api/tags')) {
      return { stdout: responses.tags };
    }
    if (joined.includes('config') && joined.includes('get')) {
      if (responses.config instanceof Error) {
        throw responses.config;
      }
      return { stdout: responses.config ?? '' };
    }
    throw new Error(`unexpected run call: ${joined}`);
  });
}

const oneModelTags = JSON.stringify({ models: [{ name: 'qwen3.5:latest' }] });

function calledProbe(run: ReturnType<typeof makeRun>): boolean {
  return run.mock.calls.some(([, args]: [string, string[]]) => isOllamaWarmupArgs(args));
}

it('keeps success severity when tags and the load probe both succeed', async () => {
  const run = makeRun({ tags: oneModelTags, probe: '{"done":true}' });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('success');
  expect(result.status).toMatch(/Detected 1 host Ollama model/);
  expect(calledProbe(run)).toBe(true);
});

it('demotes to error and surfaces OLM-006 when the load probe fails with a non-timeout error', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: new Error(REACH_FAILURE),
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('error');
  expect(result.status).toContain('OLM-006');
  expect(result.status).toContain('ECONNREFUSED');
  expect(result.code).toBe('OLM-006');
});

it('reports OLM-006 when Ollama answers with an error whose body itself mentions a timeout', async () => {
  // Ollama's runner-crash text is exactly the fault OLM-006 exists to catch;
  // the helper words HTTP failures as "returned error" so it is not mistaken
  // for a slow cold load.
  const run = makeRun({
    tags: oneModelTags,
    probe: { stderr: 'ollama-warmup: Ollama returned error HTTP 500: {"error":"timed out waiting for llama runner to start"}' },
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('error');
  expect(result.code).toBe('OLM-006');
});

it('does not demote severity when the load probe times out', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: new Error(TIMEOUT_FAILURE),
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('success');
  expect(result.status).toMatch(/Detected 1 host Ollama model/);
  expect(result.code).toBeUndefined();
});

it('matches a bare "timed out" message defensively, without demoting severity', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: new Error('Request timed out'),
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('success');
});

it('skips the load probe entirely when no models are installed', async () => {
  const run = makeRun({ tags: JSON.stringify({ models: [] }) });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('info');
  expect(calledProbe(run)).toBe(false);
});

// Production's injected `run` (ddClient.docker.cli.exec) rejects with a
// plain object, not an Error -- e.g. `{ stderr: 'ollama-warmup timed out ...' }`.
// The tests above all throw real Errors, which is a shape gap: `String(plainObj)`
// yields "[object Object]", which matches none of isProbeTimeout's patterns.
it('does not demote severity when the probe rejects with a plain object (not an Error) reporting a timeout', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: { stderr: TIMEOUT_FAILURE },
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('success');
});

it('surfaces the upstream text, not "[object Object]", when the probe rejects with a plain object reporting a non-timeout error', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: { stderr: REACH_FAILURE },
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('error');
  expect(result.status).toContain('OLM-006');
  expect(result.status).toContain('ECONNREFUSED');
  expect(result.status).not.toContain('[object Object]');
});

it('does not invoke or get demoted by the load probe when the selected model is not among the installed models', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: new Error(REACH_FAILURE),
  });

  const result = await runDetect({ run, selectedOllamaModel: 'deleted-model:latest' });

  expect(calledProbe(run)).toBe(false);
  expect(result.severity).toBe('success');
  expect(result.selectedOllamaModel).toBe('');
});

it('probes with the load-probe time budget and the selected model name, not the 120s restart-time defaults', async () => {
  const run = makeRun({ tags: oneModelTags, probe: '{"done":true}' });

  await runDetect({ run, selectedOllamaModel: 'qwen3.5:latest' });

  const probeCall = run.mock.calls.find(([, args]: [string, string[]]) => isOllamaWarmupArgs(args));
  expect(probeCall).toBeDefined();
  const [, args] = probeCall as unknown as [string, string[]];

  // [containerId, 'node', helper, 'ollama-warmup', model, timeoutSeconds]
  expect(args.slice(-3)).toEqual(['ollama-warmup', 'qwen3.5:latest', '20']);
});
