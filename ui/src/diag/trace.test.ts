// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it } from 'vitest';

import { readDiagEvents, resetDiagEvents } from './events';
import { nextActionSeq, traceAction } from './trace';

afterEach(() => resetDiagEvents());

describe('traceAction', () => {
  it('emits ordered step events sharing one runId and a terminal outcome', async () => {
    await traceAction('ollama.detect', async ({ step }) => {
      step('tags_fetch', 'ok');
      step('config_get', 'ok');
    });
    const events = readDiagEvents();
    const runIds = new Set(events.map((event) => event.runId));
    expect(runIds.size).toBe(1);
    expect(events.map((event) => event.step ?? event.action)).toEqual([
      'tags_fetch',
      'config_get',
      'ollama.detect',
    ]);
    const terminal = events[events.length - 1];
    expect(terminal.outcome).toBe('ok');
    expect(typeof terminal.durationMs).toBe('number');
  });

  it('records an error terminal outcome when the body throws and rethrows', async () => {
    await expect(
      traceAction('ollama.detect', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const terminal = readDiagEvents().at(-1);
    expect(terminal?.outcome).toBe('error');
    expect(terminal?.error?.message).toContain('boom');
  });

  it('mints monotonically increasing action sequence numbers', () => {
    const a = nextActionSeq();
    const b = nextActionSeq();
    expect(b).toBe(a + 1);
  });
});
