// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';

import { appendDiagEvent, resetDiagEvents } from './events';
import * as exportMod from './export';

afterEach(() => {
  vi.restoreAllMocks();
  resetDiagEvents();
});

it('a throwing exporter never breaks appendDiagEvent', () => {
  vi.spyOn(exportMod, 'exportEvent').mockImplementation(() => {
    throw new Error('exporter down');
  });
  expect(() => appendDiagEvent({ ts: 1, runId: 'r', action: 'a', outcome: 'ok' })).not.toThrow();
});
