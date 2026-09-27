// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { DEFAULT_EXECUTION_MODE, modeFromEffectivePolicy, parseExecModeReadOutput } from './execMode';

// Helper outputs below are the effective policies OpenClaw 2026.9.3 reports
// for: nothing configured, `exec-policy preset cautious`, `exec-policy preset yolo`.
const UNCONFIGURED = '{"security":"full","ask":"off","askFallback":"deny"}';
const CAUTIOUS = '{"security":"allowlist","ask":"on-miss","askFallback":"deny"}';
const YOLO = '{"security":"full","ask":"off","askFallback":"full"}';

describe('execution mode detection', () => {
  it('reports a fresh install as Full access, matching what OpenClaw enforces', () => {
    expect(parseExecModeReadOutput(UNCONFIGURED)).toBe('full');
  });

  it('maps the cautious preset to Safer and the yolo preset to Full access', () => {
    expect(parseExecModeReadOutput(CAUTIOUS)).toBe('safer');
    expect(parseExecModeReadOutput(YOLO)).toBe('full');
  });

  it('treats any policy stricter than full/off as Safer', () => {
    expect(modeFromEffectivePolicy({ security: 'full', ask: 'always', askFallback: 'deny' })).toBe('safer');
    expect(modeFromEffectivePolicy({ security: 'deny', ask: 'off', askFallback: 'deny' })).toBe('safer');
  });

  it('refuses to claim a mode when the policy cannot be read', () => {
    expect(parseExecModeReadOutput('')).toBeNull();
    expect(parseExecModeReadOutput('not-json')).toBeNull();
    expect(parseExecModeReadOutput('[]')).toBeNull();
    expect(parseExecModeReadOutput('{"security":"full"}')).toBeNull();
    // The pre-2026.9.3 helper output shape must not be misread as a policy.
    expect(parseExecModeReadOutput('{"approvals":{"defaults":{}},"config":{"tools":{"exec":{}}}}')).toBeNull();
  });

  it('assumes OpenClaw\'s default before the policy is read', () => {
    expect(DEFAULT_EXECUTION_MODE).toBe('full');
  });
});
