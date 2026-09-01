// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';

import { resetDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';

afterEach(() => resetDiagEvents());

type Responses = {
  tags: string;
  config?: string | Error;
  probe?: string | Error;
};

// Mirrors the real `run` call shape used by runDetect: a single command
// runner dispatched three different ways by which curl/CLI invocation it is
// asked to make. Distinguish calls by inspecting the argv, the same way the
// production code builds them.
function makeRun(responses: Responses) {
  return vi.fn(async (_cmd: string, args: string[]) => {
    const joined = args.join(' ');
    if (joined.includes('/api/generate')) {
      if (responses.probe instanceof Error) {
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
  return run.mock.calls.some(([, args]: [string, string[]]) => args.join(' ').includes('/api/generate'));
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
    probe: new Error('curl: (7) Failed to connect to host.docker.internal port 11434: Connection refused'),
  });

  const result = await runDetect({ run, selectedOllamaModel: '' });

  expect(result.severity).toBe('error');
  expect(result.status).toContain('OLM-006');
  expect(result.status).toContain('Connection refused');
  expect(result.code).toBe('OLM-006');
});

it('does not demote severity when the load probe times out', async () => {
  const run = makeRun({
    tags: oneModelTags,
    probe: new Error('curl: (28) Operation timed out after 20000 milliseconds with 0 bytes received'),
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
