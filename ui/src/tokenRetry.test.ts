// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { readGatewayTokenWithRetry } from './tokenRetry';

describe('gateway token retry helper', () => {
  it('retries empty token reads before returning the detected token', async () => {
    const reads = ['', '   ', 'token-value'];
    const attempts: string[] = [];

    const token = await readGatewayTokenWithRetry(async () => {
      const next = reads.shift() ?? '';
      attempts.push(next);
      return next;
    }, { attempts: 3, delayMs: 0 });

    expect(token).toBe('token-value');
    expect(attempts).toEqual(['', '   ', 'token-value']);
  });

  it('returns an empty token after all retry attempts are exhausted', async () => {
    let attempts = 0;

    const token = await readGatewayTokenWithRetry(async () => {
      attempts += 1;
      return '';
    }, { attempts: 3, delayMs: 0 });

    expect(token).toBe('');
    expect(attempts).toBe(3);
  });
});
