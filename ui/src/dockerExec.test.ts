// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { buildRuntimeHelperArgs } from './dockerExec';
import { buildOllamaTagsFetchArgs, buildOllamaWarmupArgs } from './ollamaSetup';
import { buildDockerPsPortCheckArgs } from './requirementChecks';
import { buildRuntimeRunArgs, buildServiceStopArgs } from './runtimeContainer';

// ddClient.docker.cli.exec joins its argv and re-splits it shell-style: an
// element containing whitespace is split, and quotes are stripped. That turned
// the Ollama probe's `Content-Type: application/json` header and JSON body into
// a request Ollama rejected (#241). Every argv the extension hands the SDK must
// therefore be free of whitespace and quote characters.
const SDK_UNSAFE = /[\s"']/;

const argvByBuilder: Record<string, string[]> = {
  'gateway-token helper': buildRuntimeHelperArgs('gateway-token'),
  'exec-mode-read helper': buildRuntimeHelperArgs('exec-mode-read'),
  'exec-mode-write helper': buildRuntimeHelperArgs('exec-mode-write', ['safer']),
  'ollama-config-write helper': buildRuntimeHelperArgs('ollama-config-write', ['qwen3:8b-opencode']),
  'ollama-auth-write helper': buildRuntimeHelperArgs('ollama-auth-write'),
  'ollama warmup': buildOllamaWarmupArgs('qwen3:8b-opencode'),
  'ollama load probe': buildOllamaWarmupArgs('hf.co/org/model:Q4_K_M', 20),
  'ollama tags fetch': buildOllamaTagsFetchArgs(),
  'docker ps port check': buildDockerPsPortCheckArgs(),
  'service stop': buildServiceStopArgs('0123456789ab'),
  'runtime run': buildRuntimeRunArgs({
    containerName: 'openclaw-docker-extension-service',
    image: 'ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.6.0',
    volumeName: 'openclaw-docker-extension-home',
    hostPort: 18789,
    bridgePort: 18790,
    labels: {
      'com.docker.extension.openclaw': 'true',
      'com.docker.extension.openclaw.role': 'service',
    },
  }),
};

describe('Docker Desktop SDK argv safety', () => {
  for (const [name, argv] of Object.entries(argvByBuilder)) {
    it(`${name} argv has no whitespace or quotes`, () => {
      expect(argv.length).toBeGreaterThan(0);
      expect(argv.filter((arg) => SDK_UNSAFE.test(arg))).toEqual([]);
    });
  }
});

describe('Docker Desktop exec helpers', () => {
  it('builds runtime helper argv without inline JavaScript for Docker Desktop SDK', () => {
    const args = buildRuntimeHelperArgs('exec-mode-read');

    expect(args).toEqual([
      'node',
      '/usr/local/bin/openclaw-extension-helper.js',
      'exec-mode-read',
    ]);
    expect(args.join(' ')).not.toContain(' -e ');
    expect(args.join(' ')).not.toContain('eval(');
    expect(args.join(' ')).not.toContain(';');
    expect(args.join(' ')).not.toContain('&&');
    expect(args.join(' ')).not.toContain('|');
  });
});
