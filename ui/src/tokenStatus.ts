export type TokenStatus = 'unknown' | 'checking' | 'ready' | 'empty' | 'error';

export function getGatewayTokenHelperText(token: string, tokenStatus: TokenStatus): string {
  if (token) {
    return 'Open Control UI passes this token in the URL fragment. Use Copy only if the dashboard asks again.';
  }
  if (tokenStatus === 'checking') {
    return 'Waiting for OpenClaw to write the gateway token. This should resolve shortly after startup.';
  }
  if (tokenStatus === 'empty') {
    return 'Gateway token is still blank after retries. Click Refresh Token, then Open Control UI again.';
  }
  if (tokenStatus === 'error') {
    return 'Could not read the gateway token. Click Refresh Token, then restart OpenClaw if it is still blank.';
  }
  return 'Gateway token appears here after the OpenClaw service is ready.';
}
