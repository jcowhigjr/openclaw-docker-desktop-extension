// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  createDemoDDClient,
  isDemoChatBlockedSearch,
  isDemoModeSearch,
} from './dockerDesktopDemoClient';

describe('Docker Desktop demo client', () => {
  it('enables demo mode only from the demo query parameter', () => {
    expect(isDemoModeSearch('?demo=1')).toBe(true);
    expect(isDemoModeSearch('?demo=true')).toBe(false);
    expect(isDemoModeSearch('')).toBe(false);
  });

  it('enables blocked-chat demo state only from the chat query parameter', () => {
    expect(isDemoChatBlockedSearch('?demo=1&chat=blocked')).toBe(true);
    expect(isDemoChatBlockedSearch('?demo=1&chat=ready')).toBe(false);
    expect(isDemoChatBlockedSearch('?demo=1')).toBe(false);
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

  it('can render an unconfigured first-chat demo state', async () => {
    const client = createDemoDDClient('?demo=1&chat=blocked');
    const tags = await client.docker.cli.exec('exec', ['curl', 'http://host.docker.internal:11434/api/tags']);
    const model = await client.docker.cli.exec('exec', ['openclaw', 'config', 'get', 'agents.defaults.model.primary']);

    expect(tags).toEqual({ stdout: '{"models":[]}', stderr: '' });
    expect(model).toEqual({ stdout: '', stderr: '' });
  });
});
