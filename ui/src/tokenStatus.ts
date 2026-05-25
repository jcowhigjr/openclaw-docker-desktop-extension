export type TokenStatus = 'unknown' | 'checking' | 'ready' | 'empty' | 'error';

export function getGatewayTokenHelperText(token: string, tokenStatus: TokenStatus): string {
  if (token) {
    return 'Auto-attached when you click Open Control UI. Use Copy only if the dashboard asks again.';
  }
  if (tokenStatus === 'checking') {
    return 'Waiting for OpenClaw to write the gateway token. This resolves shortly after startup.';
  }
  if (tokenStatus === 'empty') {
    return 'Still blank after retries. Click Refresh Token, then try re-opening the Control UI.';
  }
  if (tokenStatus === 'error') {
    return 'Could not read the gateway token. Click Refresh Token, then restart OpenClaw if still blank.';
  }
  return 'Gateway token appears here automatically once the OpenClaw service is ready.';
}
