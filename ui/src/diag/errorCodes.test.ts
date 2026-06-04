// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { classifyError, classifyOllamaTags, getRemedy } from './errorCodes';

describe('error code registry', () => {
  it('classifies discriminated tags results into stable codes', () => {
    expect(classifyOllamaTags({ ok: false, reason: 'empty' }).code).toBe('OLM-004');
    expect(classifyOllamaTags({ ok: false, reason: 'invalid' }).code).toBe('OLM-005');
    expect(classifyOllamaTags({ ok: true, models: [] }).code).toBeUndefined();
  });

  it('classifies an unset config path as informational OLM-001', () => {
    expect(classifyError('ollama.config_get', 'Config path not found: agents.defaults.model.primary').code).toBe(
      'OLM-001',
    );
  });

  it('falls back to GEN-000 for unmapped failures and always yields a remedy', () => {
    const c = classifyError('ollama.detect', 'totally unexpected explosion');
    expect(c.code).toBe('GEN-000');
    expect(getRemedy(c.code)).toMatch(/copy diagnostics/i);
  });

  it('exposes a remedy for every registered code', () => {
    for (const code of ['OLM-001', 'OLM-002', 'OLM-003', 'OLM-004', 'OLM-005', 'GEN-000']) {
      expect(getRemedy(code)).toBeTruthy();
    }
  });
});
