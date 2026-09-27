// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export type ExecutionMode = 'safer' | 'full';

// Effective exec policy as reported by `exec-mode-read`, which asks OpenClaw
// (`openclaw exec-policy show`) rather than reading files: OpenClaw 2026.9.3
// keeps approvals in SQLite, and with nothing configured it enforces
// security=full / ask=off, so file-based detection misreported every fresh
// install as Safer (#245).
export type EffectiveExecPolicy = {
  security: string;
  ask: string;
  askFallback: string | null;
};

// OpenClaw's own default when nothing is configured; also the honest
// assumption to display before the policy has been read.
export const DEFAULT_EXECUTION_MODE: ExecutionMode = 'full';

export function modeFromEffectivePolicy(policy: EffectiveExecPolicy): ExecutionMode {
  return policy.security === 'full' && policy.ask === 'off' ? 'full' : 'safer';
}

// Returns null when the helper output is not a readable policy, so callers
// report "could not read" instead of claiming a mode.
export function parseExecModeReadOutput(stdout: string): ExecutionMode | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const { security, ask, askFallback } = parsed as Record<string, unknown>;
  if (typeof security !== 'string' || typeof ask !== 'string') {
    return null;
  }
  return modeFromEffectivePolicy({
    security,
    ask,
    askFallback: typeof askFallback === 'string' ? askFallback : null,
  });
}
