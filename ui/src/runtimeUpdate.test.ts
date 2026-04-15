import { describe, expect, it } from 'vitest';

import {
  describeRuntimeImageVersion,
  isRuntimeImageUpdateable,
  parseLocalImageInspect,
  parseRemoteDigestFromBuildxOutput,
  parseRemoteDigestFromManifest,
  shouldAutoApplyRuntimeUpdate,
} from './runtimeUpdate';

describe('runtimeUpdate helpers', () => {
  it('classifies updateable runtime tags', () => {
    expect(isRuntimeImageUpdateable('ghcr.io/example/openclaw-runtime:stable')).toBe(true);
    expect(isRuntimeImageUpdateable('ghcr.io/example/openclaw-runtime:beta')).toBe(true);
    expect(isRuntimeImageUpdateable('ghcr.io/example/openclaw-runtime:v2026.4.11')).toBe(false);
    expect(isRuntimeImageUpdateable('openclaw-docker-extension-runtime:dev')).toBe(false);
  });

  it('parses local inspect digests and version labels', () => {
    const result = parseLocalImageInspect(
      JSON.stringify([
        {
          RepoDigests: [
            'ghcr.io/example/openclaw-runtime@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          ],
          Config: {
            Labels: {
              'org.opencontainers.image.version': 'v2026.4.11',
            },
          },
        },
      ]),
    );

    expect(result.digests).toEqual([
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
    expect(result.version).toBe('v2026.4.11');
  });

  it('parses remote digests from buildx and manifest output', () => {
    expect(
      parseRemoteDigestFromBuildxOutput(
        'Name: ghcr.io/example/openclaw-runtime:stable\nDigest: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n',
      ),
    ).toBe('sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    expect(
      parseRemoteDigestFromManifest(
        JSON.stringify({
          Digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        }),
      ),
    ).toBe('sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
  });

  it('decides when auto-before-launch should recreate with an updated image', () => {
    expect(
      shouldAutoApplyRuntimeUpdate('auto-before-launch', {
        image: 'ghcr.io/example/openclaw-runtime:stable',
        supported: true,
        updateAvailable: true,
        checkedAt: Date.now(),
      }),
    ).toBe(true);

    expect(
      shouldAutoApplyRuntimeUpdate('check-only', {
        image: 'ghcr.io/example/openclaw-runtime:stable',
        supported: true,
        updateAvailable: true,
        checkedAt: Date.now(),
      }),
    ).toBe(false);
  });

  it('builds human-readable runtime version labels', () => {
    expect(
      describeRuntimeImageVersion(
        'ghcr.io/example/openclaw-runtime:stable',
        'v2026.4.11',
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      ),
    ).toBe('v2026.4.11');

    expect(
      describeRuntimeImageVersion(
        'ghcr.io/example/openclaw-runtime:stable',
        undefined,
        'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      ),
    ).toBe('stable@eeeeeeeeeeee');
  });
});
