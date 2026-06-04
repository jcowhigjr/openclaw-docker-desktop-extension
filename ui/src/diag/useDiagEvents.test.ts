// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it } from 'vitest';

import { appendDiagEvent, resetDiagEvents } from './events';
import { getDiagLogText } from './useDiagEvents';

afterEach(() => resetDiagEvents());

it('renders the ring as a newline-joined, time-prefixed log', () => {
  appendDiagEvent({
    ts: new Date(2026, 0, 1, 9, 17, 7).getTime(),
    runId: 'r',
    action: 'ollama.detect',
    step: 'tags_fetch',
    outcome: 'error',
    code: 'OLM-003',
  });
  expect(getDiagLogText()).toContain('] ollama.detect:tags_fetch error [OLM-003]');
});
