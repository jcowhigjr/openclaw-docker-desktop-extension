// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { captureOllamaSnapshot, hasOllamaInvariantViolation } from './snapshot';

const base = {
  phase: 'running' as const,
  busy: false,
  ollamaChecking: false,
  ollamaStatus: '',
  ollamaAlertSeverity: 'info' as const,
  selectedOllamaModel: '',
  configuredOllamaModel: '',
  models: [{ name: 'llama3.2:latest' }],
  actionSeq: 2,
  appliedSeq: 2,
};

describe('ollama state snapshot', () => {
  it('reports modelsCount and list membership', () => {
    const snap = captureOllamaSnapshot({ ...base, selectedOllamaModel: 'llama3.2:latest' });
    expect(snap.modelsCount).toBe(1);
    expect(snap.selectedInDetectedList).toBe(true);
  });

  it('flags a selection not present in the detected list (the desync bug class)', () => {
    const state = { ...base, selectedOllamaModel: 'gone:latest' };
    const snap = captureOllamaSnapshot(state);
    expect(snap.selectedInDetectedList).toBe(false);
    expect(hasOllamaInvariantViolation(state)).toBe(true);
  });

  it('flags a stale (out-of-order) applied sequence', () => {
    expect(hasOllamaInvariantViolation({ ...base, appliedSeq: 1, actionSeq: 3 })).toBe(true);
  });

  it('treats an empty selection with an empty list as consistent', () => {
    expect(hasOllamaInvariantViolation({ ...base, models: [], selectedOllamaModel: '' })).toBe(false);
  });
});
