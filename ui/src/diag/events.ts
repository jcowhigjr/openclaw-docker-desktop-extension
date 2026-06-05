// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { formatDebugEntry } from '../debugLog';
import { exportEvent } from './export';

export const DIAG_SCHEMA_VERSION = 1 as const;
const RING_LIMIT = 200;

export type DiagOutcome = 'ok' | 'warning' | 'error';
export type DiagAttrValue = string | number | boolean | string[];

export type DiagEvent = {
  schema: typeof DIAG_SCHEMA_VERSION;
  ts: number;
  runId: string;
  action: string;
  step?: string;
  outcome: DiagOutcome;
  code?: string;
  durationMs?: number;
  attrs?: Record<string, DiagAttrValue>;
  error?: { message: string; stack?: string };
};

export type DiagEventInput = Omit<DiagEvent, 'schema'>;

let ring: DiagEvent[] = [];
const listeners = new Set<() => void>();

export function appendDiagEvent(input: DiagEventInput): DiagEvent {
  const event: DiagEvent = { schema: DIAG_SCHEMA_VERSION, ...input };
  ring = [...ring, event].slice(-RING_LIMIT);
  try {
    exportEvent(event);
  } catch {
    // Export is best-effort; never break the recorder.
  }
  listeners.forEach((listener) => listener());
  return event;
}

export function readDiagEvents(): readonly DiagEvent[] {
  return ring;
}

export function resetDiagEvents(): void {
  ring = [];
  listeners.forEach((listener) => listener());
}

export function subscribeDiagEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatDiagEvent(event: DiagEvent, date = new Date(event.ts)): string {
  const label = event.step ? `${event.action}:${event.step}` : event.action;
  const code = event.code ? ` [${event.code}]` : '';
  return formatDebugEntry(`${label} ${event.outcome}${code}`, date);
}
