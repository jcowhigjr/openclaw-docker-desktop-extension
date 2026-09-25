// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { buildRuntimeRunArgs, needsRuntimeRecreate } from './runtimeContainer';

describe('runtime container launch args', () => {
  it('keeps the OpenClaw service localhost-bound and applies runtime hardening', () => {
    const args = buildRuntimeRunArgs({
      containerName: 'openclaw-docker-extension-service',
      image: 'ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest',
      volumeName: 'openclaw-docker-extension-home',
      hostPort: 18789,
      bridgePort: 18790,
      labels: {
        'com.docker.extension.openclaw': 'true',
        'com.docker.extension.openclaw.role': 'service',
      },
    });

    expect(args).toEqual([
      '-d',
      '--name',
      'openclaw-docker-extension-service',
      '--platform',
      'linux/arm64',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=64m',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--ulimit',
      'nofile=1024:1024',
      '-v',
      'openclaw-docker-extension-home:/home/node',
      '-p',
      '127.0.0.1:18789:18790',
      '--label',
      'com.docker.extension.openclaw=true',
      '--label',
      'com.docker.extension.openclaw.role=service',
      'ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest',
    ]);
  });
});

describe('pinned runtime recreate decision', () => {
  const pinned = 'ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.6.0';

  it('keeps a service already running the pinned image', () => {
    expect(needsRuntimeRecreate(pinned, pinned)).toBe(false);
  });

  it('recreates a service created by an older extension release', () => {
    expect(needsRuntimeRecreate('ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.5.0', pinned)).toBe(true);
  });

  it('recreates a service whose image tag has since moved on (reported as a bare image id)', () => {
    expect(needsRuntimeRecreate('sha256:808da8c1e0f2', pinned)).toBe(true);
  });

  it('leaves a service alone when Docker does not report its image', () => {
    expect(needsRuntimeRecreate(undefined, pinned)).toBe(false);
    expect(needsRuntimeRecreate('  ', pinned)).toBe(false);
  });
});
