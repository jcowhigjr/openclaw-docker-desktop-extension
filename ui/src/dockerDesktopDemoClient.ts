// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
type DemoExecResult = {
  stdout: string;
  stderr: string;
};

export type DemoDockerDesktopClient = {
  docker: {
    listContainers: (_options: unknown) => Promise<Array<{
      Id: string;
      State: string;
      Status: string;
      Names: string[];
    }>>;
    cli: {
      exec: (command: string, args?: string[]) => Promise<DemoExecResult>;
    };
  };
  host: {
    openExternal: (_url: string) => Promise<void>;
  };
};

export function isDemoModeSearch(search: string): boolean {
  return new URLSearchParams(search).get('demo') === '1';
}

export function isDemoChatBlockedSearch(search: string): boolean {
  return new URLSearchParams(search).get('chat') === 'blocked';
}

export type DemoModelsFixture = 'none' | 'one' | 'many';

// `models=many`, an absent flag, and any unrecognised value all resolve to
// 'many' -- the two-model fixture that has always been the default -- so a
// typo in the query string degrades to today's behaviour instead of throwing.
export function parseDemoModelsSearch(search: string): DemoModelsFixture {
  const value = new URLSearchParams(search).get('models');
  if (value === 'none' || value === 'one') {
    return value;
  }
  return 'many';
}

export type DemoProbeFixture = 'ok' | 'fail' | 'timeout';

// `probe=ok`, an absent flag, and any unrecognised value all resolve to 'ok',
// matching today's always-succeeds behaviour.
export function parseDemoProbeSearch(search: string): DemoProbeFixture {
  const value = new URLSearchParams(search).get('probe');
  if (value === 'fail' || value === 'timeout') {
    return value;
  }
  return 'ok';
}

export function isDemoConfiguredStaleSearch(search: string): boolean {
  return new URLSearchParams(search).get('configured') === 'stale';
}

export function createDemoDDClient(search = ''): DemoDockerDesktopClient {
  const chatBlocked = isDemoChatBlockedSearch(search);
  const modelsFixture = parseDemoModelsSearch(search);
  const probeFixture = parseDemoProbeSearch(search);
  const configuredStale = isDemoConfiguredStaleSearch(search);

  const tagsPayload = (): { models: Array<{ name: string; size: number }> } => {
    if (chatBlocked || modelsFixture === 'none') {
      return { models: [] };
    }

    if (modelsFixture === 'one') {
      return { models: [{ name: 'llama3.2:latest', size: 2019393189 }] };
    }

    return {
      models: [
        { name: 'llama3.2:latest', size: 2019393189 },
        { name: 'qwen3.5:latest', size: 6594474711 },
      ],
    };
  };

  const exec = async (command: string, args: string[] = []): Promise<DemoExecResult> => {
    if (command === 'version') {
      return { stdout: '29.5.0\n', stderr: '' };
    }

    if (command === 'ps') {
      return { stdout: '', stderr: '' };
    }

    if (command === 'inspect' && args.includes('{{.Image}}')) {
      return { stdout: 'sha256:demo-running\n', stderr: '' };
    }

    if (command === 'inspect' && args.includes('{{.Id}}')) {
      return { stdout: 'sha256:demo-running\n', stderr: '' };
    }

    if (command === 'pull') {
      return { stdout: '', stderr: '' };
    }

    if (command === 'exec' && args.some((arg) => arg.endsWith('/api/tags'))) {
      return { stdout: JSON.stringify(tagsPayload()), stderr: '' };
    }

    if (
      command === 'exec' &&
      probeFixture !== 'ok' &&
      args.some((arg) => arg.endsWith('/api/generate'))
    ) {
      // Docker Desktop's real `exec` rejects with a plain object (read via
      // formatUnknownError), never an Error -- match that here so demo mode
      // cannot hide the same divergence that previously masked a Critical
      // defect.
      if (probeFixture === 'fail') {
        throw { stderr: 'curl: (22) The requested URL returned error: 500' };
      }

      throw { stderr: 'curl: (28) Operation timed out after 20001 milliseconds' };
    }

    if (command === 'exec' && args.includes('agents.defaults.model.primary')) {
      if (chatBlocked) {
        return { stdout: '', stderr: '' };
      }

      if (configuredStale) {
        return { stdout: 'gone:latest\n', stderr: '' };
      }

      return { stdout: 'llama3.2:latest\n', stderr: '' };
    }

    if (command === 'exec') {
      return { stdout: 'demo-token', stderr: '' };
    }

    return { stdout: '', stderr: '' };
  };

  return {
    docker: {
      listContainers: async () => [
        {
          Id: 'demo-openclaw',
          State: 'running',
          Status: 'Up 3 minutes (healthy)',
          Names: ['/openclaw-docker-extension-service'],
        },
      ],
      cli: { exec },
    },
    host: {
      openExternal: async () => undefined,
    },
  };
}
