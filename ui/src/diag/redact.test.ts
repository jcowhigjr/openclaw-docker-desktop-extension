// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { redact } from './redact';

describe('redact', () => {
  it('masks bearer tokens and gateway tokens', () => {
    expect(redact('Authorization: Bearer SAMPLE-VALUE')).toBe('Authorization: Bearer [REDACTED]');
    expect(redact('token=SAMPLE-VALUE')).toBe('token=[REDACTED]');
  });

  it('anonymizes absolute home paths', () => {
    expect(redact('/Users/jane/.openclaw/config.json')).toBe('/Users/~/.openclaw/config.json');
    expect(redact('/home/bob/work')).toBe('/home/~/work');
  });

  it('leaves benign text unchanged', () => {
    expect(redact('Detected 2 host Ollama models.')).toBe('Detected 2 host Ollama models.');
  });
});
