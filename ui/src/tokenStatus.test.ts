import { describe, expect, it } from 'vitest';

import { getGatewayTokenHelperText } from './tokenStatus';

describe('gateway token status text', () => {
  it('gives a simple recovery action when token retries are exhausted', () => {
    expect(getGatewayTokenHelperText('', 'empty')).toBe(
      'Still blank after retries. Click Refresh Token, then try re-opening the Control UI.',
    );
  });

  it('keeps the successful bootstrap guidance when a token is available', () => {
    expect(getGatewayTokenHelperText('token-value', 'ready')).toBe(
      'Auto-attached when you click Open Control UI. Use Copy only if the dashboard asks again.',
    );
  });
});
