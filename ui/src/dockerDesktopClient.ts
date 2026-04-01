import { createDockerDesktopClient } from '@docker/extension-api-client';

export type DockerDesktopClient = ReturnType<typeof createDockerDesktopClient>;

let cachedClient: DockerDesktopClient | null = null;

export function getDDClient(): DockerDesktopClient {
  if (!cachedClient) {
    cachedClient = createDockerDesktopClient();
  }

  return cachedClient;
}
