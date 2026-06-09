// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { createDockerDesktopClient } from '@docker/extension-api-client';

import { createDemoDDClient, isDemoModeSearch, type DemoDockerDesktopClient } from './dockerDesktopDemoClient';

export type DockerDesktopClient = ReturnType<typeof createDockerDesktopClient> | DemoDockerDesktopClient;

let cachedClient: DockerDesktopClient | null = null;

export function isDemoMode(): boolean {
  return typeof window !== 'undefined' && isDemoModeSearch(window.location.search);
}

export function getDDClient(): DockerDesktopClient {
  if (isDemoMode()) {
    return createDemoDDClient(window.location.search) as unknown as DockerDesktopClient;
  }

  if (!cachedClient) {
    cachedClient = createDockerDesktopClient();
  }

  return cachedClient;
}
