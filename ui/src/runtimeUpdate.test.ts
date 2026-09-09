// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  describeRuntimeImageVersion,
  isRuntimeImageUpdateable,
  migrateStoredRuntimeImage,
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

  it('migrates only genuinely obsolete upstream refs, never a local tag (#220)', () => {
    const fallback = 'ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:latest';

    // The two known-obsolete refs from earlier extension versions still migrate.
    expect(migrateStoredRuntimeImage('ghcr.io/openclaw/openclaw:latest', fallback)).toBe(fallback);
    expect(
      migrateStoredRuntimeImage('ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest', fallback),
    ).toBe(fallback);

    // A locally-scoped tag -- exactly what `make install-dev` produces, and
    // what a maintainer pins Settings to on a recovery host -- must round-trip
    // unchanged. This is the regression #220 was filed against: this value
    // was silently rewritten back to `fallback` on every load.
    expect(migrateStoredRuntimeImage('openclaw-docker-extension-runtime:dev', fallback)).toBe(
      'openclaw-docker-extension-runtime:dev',
    );

    // Any other locally-scoped or pinned-release ref is left alone too.
    expect(migrateStoredRuntimeImage('openclaw-docker-extension-runtime:working', fallback)).toBe(
      'openclaw-docker-extension-runtime:working',
    );
    expect(
      migrateStoredRuntimeImage('ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.6', fallback),
    ).toBe('ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.6');

    // Whitespace from a hand-edited field does not defeat the exact match.
    expect(migrateStoredRuntimeImage('  ghcr.io/openclaw/openclaw:latest  ', fallback)).toBe(fallback);
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
