// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it } from 'vitest';

import {
  DIAG_SCHEMA_VERSION,
  appendDiagEvent,
  formatDiagEvent,
  readDiagEvents,
  resetDiagEvents,
} from './events';

afterEach(() => resetDiagEvents());

describe('diag events ring buffer', () => {
  it('appends events and reads them back in order', () => {
    appendDiagEvent({ ts: 1, runId: 'r1', action: 'a', outcome: 'ok' });
    appendDiagEvent({ ts: 2, runId: 'r1', action: 'a', step: 's', outcome: 'error', code: 'X-1' });
    const events = readDiagEvents();
    expect(events).toHaveLength(2);
    expect(events[0].schema).toBe(DIAG_SCHEMA_VERSION);
    expect(events[1].code).toBe('X-1');
  });

  it('caps the ring at the configured limit, dropping oldest', () => {
    for (let i = 0; i < 250; i += 1) {
      appendDiagEvent({ ts: i, runId: 'r', action: 'a', outcome: 'ok' });
    }
    const events = readDiagEvents();
    expect(events).toHaveLength(200);
    expect(events[0].ts).toBe(50);
    expect(events[199].ts).toBe(249);
  });

  it('formats an event as a time-prefixed line preserving the legacy shape', () => {
    const line = formatDiagEvent(
      {
        schema: DIAG_SCHEMA_VERSION,
        ts: 0,
        runId: 'r',
        action: 'ollama.detect',
        step: 'tags_fetch',
        outcome: 'error',
        code: 'OLM-003',
      },
      new Date(2026, 0, 1, 9, 17, 7),
    );
    expect(line).toBe('[09:17:07] ollama.detect:tags_fetch error [OLM-003]');
  });

  it('reset empties the ring (test isolation)', () => {
    appendDiagEvent({ ts: 1, runId: 'r', action: 'a', outcome: 'ok' });
    resetDiagEvents();
    expect(readDiagEvents()).toEqual([]);
  });
});
