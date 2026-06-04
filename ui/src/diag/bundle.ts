// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { DiagEvent } from './events';
import { redact } from './redact';

export type DiagEnv = {
  extensionVersion: string;
  runtimeImage: string;
  dockerDesktop: string;
  os: string;
};

export function buildDiagnosticsBundle(
  env: DiagEnv,
  events: readonly DiagEvent[],
  snapshot: Record<string, unknown>,
  containerHealth: string | undefined,
): string {
  const versions = Object.entries(env)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
  const snap = Object.entries(snapshot)
    .map(([key, value]) => `- ${key}: ${redact(String(value))}`)
    .join('\n');
  const lines = events
    .map((event) => {
      const label = `${event.action}${event.step ? `:${event.step}` : ''}`;
      const code = event.code ? ` [${event.code}]` : '';
      const error = event.error ? ` - ${redact(event.error.message)}` : '';
      return `- [${new Date(event.ts).toISOString()}] ${label} ${event.outcome}${code}${error}`;
    })
    .join('\n');

  return [
    '## Diagnostics',
    '',
    '### Versions',
    versions,
    '',
    '### Container health',
    `container health: ${containerHealth ? redact(containerHealth) : 'unavailable'}`,
    '',
    '### State snapshot',
    snap || '- (none)',
    '',
    '### Recent events',
    lines || '- (none)',
    '',
  ].join('\n');
}
