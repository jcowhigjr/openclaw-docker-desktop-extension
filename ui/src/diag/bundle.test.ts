// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { buildDiagnosticsBundle } from './bundle';
import { DIAG_SCHEMA_VERSION, type DiagEvent } from './events';

const env = {
  extensionVersion: '0.3.5',
  runtimeImage: 'ghcr.io/x:latest',
  dockerDesktop: '29.5.0',
  os: 'darwin/arm64',
};
const events: DiagEvent[] = [
  {
    schema: DIAG_SCHEMA_VERSION,
    ts: 0,
    runId: 'r',
    action: 'ollama.detect',
    step: 'tags_fetch',
    outcome: 'error',
    code: 'OLM-003',
  },
];

describe('buildDiagnosticsBundle', () => {
  it('produces deterministic redacted markdown with versions, events, snapshot', () => {
    const md = buildDiagnosticsBundle(env, events, { phase: 'running', selectedOllamaModel: '' }, 'Up 3 minutes');
    expect(md).toContain('## Diagnostics');
    expect(md).toContain('extensionVersion: 0.3.5');
    expect(md).toContain('OLM-003');
    expect(md).toContain('Up 3 minutes');
  });

  it('degrades gracefully when container health is unavailable', () => {
    const md = buildDiagnosticsBundle(env, events, {}, undefined);
    expect(md).toContain('container health: unavailable');
  });

  it('redacts secrets in event/snapshot text', () => {
    const md = buildDiagnosticsBundle(env, events, { ollamaStatus: 'token=SAMPLE-VALUE' }, undefined);
    expect(md).toContain('token=[REDACTED]');
    expect(md).not.toContain('SAMPLE-VALUE');
  });
});
