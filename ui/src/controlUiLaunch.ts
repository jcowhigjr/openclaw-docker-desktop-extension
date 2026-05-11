export function buildControlUiLaunchUrl(baseUrl: string, token: string): string {
  const trimmedBaseUrl = baseUrl.trim();
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return trimmedBaseUrl;
  }

  const url = new URL(trimmedBaseUrl);
  const fragment = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  fragment.set('token', trimmedToken);
  url.hash = fragment.toString();
  return url.toString();
}
