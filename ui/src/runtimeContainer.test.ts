import { describe, expect, it } from 'vitest';

import { buildRuntimeRunArgs } from './runtimeContainer';

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
