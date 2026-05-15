import { createDockerDesktopClient } from '@docker/extension-api-client';

import { createDemoDDClient, isDemoModeSearch, type DemoDockerDesktopClient } from './dockerDesktopDemoClient';

export type DockerDesktopClient = ReturnType<typeof createDockerDesktopClient> | DemoDockerDesktopClient;

let cachedClient: DockerDesktopClient | null = null;

export function isDemoMode(): boolean {
  return typeof window !== 'undefined' && isDemoModeSearch(window.location.search);
}

export function getDDClient(): DockerDesktopClient {
  if (isDemoMode()) {
    return createDemoDDClient() as unknown as DockerDesktopClient;
  }

  if (!cachedClient) {
    cachedClient = createDockerDesktopClient();
  }

  return cachedClient;
}
