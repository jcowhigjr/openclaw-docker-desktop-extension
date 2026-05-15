import { describe, expect, it } from 'vitest';

import { createDemoDDClient, isDemoModeSearch } from './dockerDesktopDemoClient';

describe('Docker Desktop demo client', () => {
  it('enables demo mode only from the demo query parameter', () => {
    expect(isDemoModeSearch('?demo=1')).toBe(true);
    expect(isDemoModeSearch('?demo=true')).toBe(false);
    expect(isDemoModeSearch('')).toBe(false);
  });

  it('provides a representative Docker Desktop client for browser screenshots', async () => {
    const client = createDemoDDClient();
    const containers = await client.docker.listContainers({ all: true });
    const version = await client.docker.cli.exec('version', ['--format', '{{.Server.Version}}']);

    expect(containers).toEqual([
      {
        Id: 'demo-openclaw',
        State: 'running',
        Status: 'Up 3 minutes (healthy)',
        Names: ['/openclaw-docker-extension-service'],
      },
    ]);
    expect(version).toEqual({ stdout: '29.5.0\n', stderr: '' });
  });
});
