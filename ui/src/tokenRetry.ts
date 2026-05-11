export type GatewayTokenRetryOptions = {
  attempts: number;
  delayMs: number;
};

export async function readGatewayTokenWithRetry(
  readToken: () => Promise<string>,
  options: GatewayTokenRetryOptions,
): Promise<string> {
  const attempts = Math.max(1, options.attempts);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const token = (await readToken()).trim();
    if (token) {
      return token;
    }

    if (attempt < attempts - 1 && options.delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, options.delayMs));
    }
  }

  return '';
}
