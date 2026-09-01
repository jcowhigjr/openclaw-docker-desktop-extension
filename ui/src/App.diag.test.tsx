// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readDiagEvents, resetDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';

afterEach(() => resetDiagEvents());

function runnerMock(responses: {
  tags: { stdout?: string } | Error;
  config: { stdout?: string } | Error;
  probe?: { stdout?: string } | Error;
}) {
  return vi.fn(async (_cmd: string, args: string[]) => {
    const target = args.some((arg) => arg.includes('/api/tags'))
      ? responses.tags
      : args.some((arg) => arg.includes('/api/generate'))
        ? (responses.probe ?? { stdout: '{}' })
        : responses.config;
    if (target instanceof Error) {
      throw target;
    }
    return target;
  });
}

describe('runDetect diagnostics', () => {
  it('emits OLM-003 when the tags fetch is unreachable', async () => {
    const run = runnerMock({ tags: new Error('curl: (7) connection refused'), config: { stdout: '' } });
    const out = await runDetect({ run, selectedOllamaModel: '' });
    expect(out.code).toBe('OLM-003');
    expect(readDiagEvents().some((event) => event.code === 'OLM-003')).toBe(true);
  });

  it('emits OLM-004 for an empty tags body and clears selection', async () => {
    const run = runnerMock({ tags: { stdout: '' }, config: { stdout: '' } });
    const out = await runDetect({ run, selectedOllamaModel: 'llama3.2:latest' });
    expect(out.code).toBe('OLM-004');
    expect(out.selectedOllamaModel).toBe('');
  });

  it('flags a successful-but-stale selection via an invariant snapshot on ok', async () => {
    const run = runnerMock({
      tags: { stdout: JSON.stringify({ models: [{ name: 'qwen3.5:latest' }] }) },
      config: { stdout: '' },
    });
    const out = await runDetect({ run, selectedOllamaModel: 'gone:latest' });
    const terminal = readDiagEvents().at(-1);
    expect(terminal?.attrs?.selectedInDetectedList).toBe(false);
    expect(out.selectedOllamaModel).not.toBe('gone:latest');
  });

  it('treats a missing OpenClaw model config path as unconfigured, not unreachable', async () => {
    const run = runnerMock({
      tags: { stdout: JSON.stringify({ models: [{ name: 'gemma4:latest' }] }) },
      config: new Error(
        'Config path not found: agents.defaults.model.primary. Run openclaw config validate to inspect config shape.',
      ),
    });

    const out = await runDetect({ run, selectedOllamaModel: '' });

    expect(out.severity).toBe('success');
    expect(out.models).toEqual([{ name: 'gemma4:latest' }]);
    expect(out.configuredOllamaModel).toBe('');
    expect(out.selectedOllamaModel).toBe('gemma4:latest');
    expect(out.status).toBe('Detected 1 host Ollama model.');
  });
});
