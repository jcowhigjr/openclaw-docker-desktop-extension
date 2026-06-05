// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { DiagEvent } from './events';

// Inert by default. A future paid-tier exporter can replace this implementation.
// Contract: best-effort, async-safe, opt-in, redacted before egress, and never
// throws into the recorder.
export function exportEvent(_event: DiagEvent): void {
  // no-op
}
