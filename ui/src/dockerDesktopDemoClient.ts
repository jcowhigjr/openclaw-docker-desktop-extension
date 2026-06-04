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

export function createDemoDDClient(): DemoDockerDesktopClient {
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
      return {
        stdout: JSON.stringify({
          models: [
            { name: 'llama3.2:latest', size: 2019393189 },
            { name: 'qwen3.5:latest', size: 6594474711 },
          ],
        }),
        stderr: '',
      };
    }

    if (command === 'exec' && args.includes('agents.defaults.model.primary')) {
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
