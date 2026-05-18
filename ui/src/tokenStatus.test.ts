import { describe, expect, it } from 'vitest';

import { getGatewayTokenHelperText } from './tokenStatus';

describe('gateway token status text', () => {
  it('gives a simple recovery action when token retries are exhausted', () => {
    expect(getGatewayTokenHelperText('', 'empty')).toBe(
      'Gateway token is still blank after retries. Click Refresh Token, then Open Control UI again.',
    );
  });

  it('keeps the successful bootstrap guidance when a token is available', () => {
    expect(getGatewayTokenHelperText('token-value', 'ready')).toBe(
      'Open Control UI passes this token in the URL fragment. Use Copy only if the dashboard asks again.',
    );
  });
});
