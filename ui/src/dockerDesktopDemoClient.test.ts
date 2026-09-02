// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  createDemoDDClient,
  isDemoChatBlockedSearch,
  isDemoConfiguredStaleSearch,
  isDemoModeSearch,
  parseDemoModelsSearch,
  parseDemoProbeSearch,
} from './dockerDesktopDemoClient';

const TAGS_ARGS = ['curl', 'http://host.docker.internal:11434/api/tags'];
const GENERATE_ARGS = ['curl', '-X', 'POST', 'http://host.docker.internal:11434/api/generate'];
const CONFIGURED_ARGS = ['openclaw', 'config', 'get', 'agents.defaults.model.primary'];

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

  it('parses the models fixture flag, falling back to "many" for absent or unrecognised values', () => {
    expect(parseDemoModelsSearch('?demo=1&models=none')).toBe('none');
    expect(parseDemoModelsSearch('?demo=1&models=one')).toBe('one');
    expect(parseDemoModelsSearch('?demo=1&models=many')).toBe('many');
    expect(parseDemoModelsSearch('?demo=1')).toBe('many');
    expect(parseDemoModelsSearch('?demo=1&models=bogus')).toBe('many');
  });

  it('parses the probe fixture flag, falling back to "ok" for absent or unrecognised values', () => {
    expect(parseDemoProbeSearch('?demo=1&probe=fail')).toBe('fail');
    expect(parseDemoProbeSearch('?demo=1&probe=timeout')).toBe('timeout');
    expect(parseDemoProbeSearch('?demo=1&probe=ok')).toBe('ok');
    expect(parseDemoProbeSearch('?demo=1')).toBe('ok');
    expect(parseDemoProbeSearch('?demo=1&probe=bogus')).toBe('ok');
  });

  it('recognises the configured=stale flag only from its exact value', () => {
    expect(isDemoConfiguredStaleSearch('?demo=1&configured=stale')).toBe(true);
    expect(isDemoConfiguredStaleSearch('?demo=1&configured=fresh')).toBe(false);
    expect(isDemoConfiguredStaleSearch('?demo=1')).toBe(false);
  });

  it('models=none reports zero installed models', async () => {
    const client = createDemoDDClient('?demo=1&models=none');
    const tags = await client.docker.cli.exec('exec', TAGS_ARGS);

    expect(tags).toEqual({ stdout: JSON.stringify({ models: [] }), stderr: '' });
  });

  it('models=one reports a single model, keeping the existing size', async () => {
    const client = createDemoDDClient('?demo=1&models=one');
    const tags = await client.docker.cli.exec('exec', TAGS_ARGS);

    expect(tags).toEqual({
      stdout: JSON.stringify({ models: [{ name: 'llama3.2:latest', size: 2019393189 }] }),
      stderr: '',
    });
  });

  it('models=many (and an unrecognised value) reports the default two-model fixture', async () => {
    for (const search of ['?demo=1&models=many', '?demo=1&models=bogus', '?demo=1']) {
      const client = createDemoDDClient(search);
      const tags = await client.docker.cli.exec('exec', TAGS_ARGS);

      expect(tags).toEqual({
        stdout: JSON.stringify({
          models: [
            { name: 'llama3.2:latest', size: 2019393189 },
            { name: 'qwen3.5:latest', size: 6594474711 },
          ],
        }),
        stderr: '',
      });
    }
  });

  it('probe=fail rejects with a plain object carrying a non-timeout curl error', async () => {
    const client = createDemoDDClient('?demo=1&probe=fail');

    expect.assertions(3);
    try {
      await client.docker.cli.exec('exec', GENERATE_ARGS);
    } catch (error) {
      expect(error).not.toBeInstanceOf(Error);
      expect(typeof error).toBe('object');
      expect((error as { stderr: string }).stderr).toBe(
        'curl: (22) The requested URL returned error: 500',
      );
    }
  });

  it('probe=timeout rejects with a plain object carrying a curl timeout', async () => {
    const client = createDemoDDClient('?demo=1&probe=timeout');

    expect.assertions(3);
    try {
      await client.docker.cli.exec('exec', GENERATE_ARGS);
    } catch (error) {
      expect(error).not.toBeInstanceOf(Error);
      expect(typeof error).toBe('object');
      expect((error as { stderr: string }).stderr).toBe(
        'curl: (28) Operation timed out after 20001 milliseconds',
      );
    }
  });

  it('probe=ok (and an absent flag) resolves the generate probe as before', async () => {
    for (const search of ['?demo=1&probe=ok', '?demo=1']) {
      const client = createDemoDDClient(search);
      await expect(client.docker.cli.exec('exec', GENERATE_ARGS)).resolves.toEqual({
        stdout: 'demo-token',
        stderr: '',
      });
    }
  });

  it('configured=stale reports a primary model absent from the active tags fixture', async () => {
    const client = createDemoDDClient('?demo=1&configured=stale');
    const tags = await client.docker.cli.exec('exec', TAGS_ARGS);
    const model = await client.docker.cli.exec('exec', CONFIGURED_ARGS);

    const parsed = JSON.parse(tags.stdout) as { models: Array<{ name: string }> };
    expect(model).toEqual({ stdout: 'gone:latest\n', stderr: '' });
    expect(parsed.models.some((m) => m.name === 'gone:latest')).toBe(false);
  });

  it('default ?demo=1 produces the same tags payload and configured model as before', async () => {
    const client = createDemoDDClient('?demo=1');
    const tags = await client.docker.cli.exec('exec', TAGS_ARGS);
    const model = await client.docker.cli.exec('exec', CONFIGURED_ARGS);

    expect(tags).toEqual({
      stdout: JSON.stringify({
        models: [
          { name: 'llama3.2:latest', size: 2019393189 },
          { name: 'qwen3.5:latest', size: 6594474711 },
        ],
      }),
      stderr: '',
    });
    expect(model).toEqual({ stdout: 'llama3.2:latest\n', stderr: '' });
  });
});
