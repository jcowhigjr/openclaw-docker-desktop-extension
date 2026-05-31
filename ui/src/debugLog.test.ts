// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { appendDebugEntry, formatDebugEntry } from './debugLog';

describe('debug log helpers', () => {
  it('formats entries with a local time prefix', () => {
    const date = new Date('2026-05-12T23:45:06Z');

    expect(formatDebugEntry('host health check passed', date)).toMatch(
      /^\[\d{2}:\d{2}:\d{2}\] host health check passed$/,
    );
  });

  it('appends new entries after existing output', () => {
    const date = new Date('2026-05-12T23:45:06Z');

    expect(appendDebugEntry('previous line', 'requirements check passed', date)).toMatch(
      /^previous line\n\[\d{2}:\d{2}:\d{2}\] requirements check passed$/,
    );
  });

  it('trims old output when the log exceeds the configured limit', () => {
    const date = new Date('2026-05-12T23:45:06Z');

    const next = appendDebugEntry('abcdef', 'new', date, 10);

    expect(next.length).toBeLessThanOrEqual(10);
    expect(next).toContain('new');
    expect(next).not.toContain('abcdef');
  });
});
