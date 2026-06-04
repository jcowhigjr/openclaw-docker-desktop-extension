// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { appendDiagEvent, type DiagAttrValue, type DiagOutcome } from './events';

let actionSeq = 0;

export function nextActionSeq(): number {
  actionSeq += 1;
  return actionSeq;
}

function makeRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type StepFn = (
  step: string,
  outcome: DiagOutcome,
  extra?: {
    code?: string;
    attrs?: Record<string, DiagAttrValue>;
    error?: { message: string; stack?: string };
  },
) => void;

export type TraceContext = {
  runId: string;
  actionSeq: number;
  step: StepFn;
};

function toErrorPayload(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export async function traceAction<T>(
  action: string,
  body: (context: TraceContext) => Promise<T> | T,
): Promise<T> {
  const runId = makeRunId();
  const seq = nextActionSeq();
  const started = Date.now();
  const step: StepFn = (name, outcome, extra = {}) => {
    appendDiagEvent({
      ts: Date.now(),
      runId,
      action,
      step: name,
      outcome,
      attrs: { actionSeq: seq, ...extra.attrs },
      code: extra.code,
      error: extra.error,
    });
  };

  try {
    const result = await body({ runId, actionSeq: seq, step });
    appendDiagEvent({
      ts: Date.now(),
      runId,
      action,
      outcome: 'ok',
      durationMs: Date.now() - started,
      attrs: { actionSeq: seq },
    });
    return result;
  } catch (error) {
    appendDiagEvent({
      ts: Date.now(),
      runId,
      action,
      outcome: 'error',
      durationMs: Date.now() - started,
      attrs: { actionSeq: seq },
      error: toErrorPayload(error),
    });
    throw error;
  }
}
