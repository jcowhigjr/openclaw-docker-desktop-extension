// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { buildControlUiLaunchUrl } from './controlUiLaunch';

describe('control UI launch helpers', () => {
  it('returns the canonical localhost URL when no token is available', () => {
    expect(buildControlUiLaunchUrl('http://127.0.0.1:18789', '')).toBe('http://127.0.0.1:18789');
  });

  it('adds the gateway token as a URL fragment for dashboard bootstrap', () => {
    expect(buildControlUiLaunchUrl('http://127.0.0.1:18789', 'abc 123')).toBe(
      'http://127.0.0.1:18789/#token=abc+123',
    );
  });

  it('preserves existing non-token fragment parameters', () => {
    expect(buildControlUiLaunchUrl('http://127.0.0.1:18789/#session=main', 'token-value')).toBe(
      'http://127.0.0.1:18789/#session=main&token=token-value',
    );
  });
});
