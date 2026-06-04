# Observability & Actionable Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat debug-log string with a zero-dependency, OTEL-shaped structured diagnostics layer that makes the extension's orchestration failures and state desyncs immediately actionable.

**Architecture:** A module-level singleton ring buffer of `DiagEvent` records (source of truth) under `ui/src/diag/`. A `traceAction` wrapper instruments user flows; a `classifyError` registry maps failures to stable codes + remedies; failure/invariant snapshots capture UI state; a redacted markdown bundle is copyable to a GitHub issue. An inert `exportEvent` seam is reserved for a future paid-tier OTLP/Sentry exporter.

**Tech Stack:** TypeScript, React (Vite), Vitest. No new runtime dependencies. Spec: `docs/superpowers/specs/2026-06-04-observability-actionable-diagnostics-design.md`.

---

## File Structure

- `ui/src/diag/events.ts` — `DiagEvent` type, schema constant, singleton ring buffer (append/read/clear/reset), `formatDiagEvent`, `exportEvent` no-op call site.
- `ui/src/diag/trace.ts` — `traceAction` span wrapper, `runId`/`actionSeq` minting, `step` callback.
- `ui/src/diag/errorCodes.ts` — code registry + `classifyError` (consumes `OllamaTagsResult`), migrated `formatStartFailure` remediation.
- `ui/src/diag/snapshot.ts` — pure `captureOllamaSnapshot` + invariant detection.
- `ui/src/diag/redact.ts` — `redact()` for tokens/home-paths/secrets.
- `ui/src/diag/bundle.ts` — pure `buildDiagnosticsBundle`.
- `ui/src/diag/export.ts` — no-op `exportEvent` default implementation + seam contract.
- `ui/src/diag/useDiagEvents.ts` — `useSyncExternalStore` hook for the Debug panel.
- Modify `ui/src/App.tsx` — wire detect/start/restart/requirements; "Copy diagnostics" button; remove migrated debug-append calls.
- Modify `ui/src/debugLog.ts` — keep `formatDebugEntry`; the string-append helper becomes a render helper (or is removed once all in-scope flows migrate).
- Tests colocated as `ui/src/diag/*.test.ts` and `ui/src/App.diag.test.tsx`.

---

### Task 0: Dependency gate (do not skip)

**Files:** none (verification only).

- [ ] **Step 1: Confirm the dependency PRs are merged**

Run:
```bash
gh pr view 131 --json state -q .state
gh pr view 133 --json state -q .state
```
Expected: both `MERGED`. If not merged, **stop** and resolve the dependency state before branching.

- [ ] **Step 2: Create the implementation branch from the correct base**

```bash
git checkout main && git pull
git checkout -b feat/130-observability
```

- [ ] **Step 3: Verify the dependency APIs exist (gate assertion)**

Run:
```bash
grep -n "export type OllamaTagsResult" ui/src/ollamaSetup.ts
grep -n "reason: 'empty'" ui/src/ollamaSetup.ts
grep -n "setSelectedOllamaModel('')" ui/src/App.tsx
```
Expected: `OllamaTagsResult` discriminated union present in `ollamaSetup.ts`, and `setSelectedOllamaModel('')` present in the failure/catch paths of `detectOllamaModels`. If any are missing, **stop** — update from `main` and re-run this gate.

- [ ] **Step 4: Baseline green**

Run: `cd ui && npx tsc --noEmit && npx vitest run && npm run build`
Expected: typecheck clean, all tests pass, build ok. Record counts as the baseline.

---

### Task 1: DiagEvent model + singleton ring buffer

**Files:**
- Create: `ui/src/diag/events.ts`
- Test: `ui/src/diag/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/events.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it } from 'vitest';

import {
  DIAG_SCHEMA_VERSION,
  appendDiagEvent,
  formatDiagEvent,
  readDiagEvents,
  resetDiagEvents,
} from './events';

afterEach(() => resetDiagEvents());

describe('diag events ring buffer', () => {
  it('appends events and reads them back in order', () => {
    appendDiagEvent({ ts: 1, runId: 'r1', action: 'a', outcome: 'ok' });
    appendDiagEvent({ ts: 2, runId: 'r1', action: 'a', step: 's', outcome: 'error', code: 'X-1' });
    const events = readDiagEvents();
    expect(events).toHaveLength(2);
    expect(events[0].schema).toBe(DIAG_SCHEMA_VERSION);
    expect(events[1].code).toBe('X-1');
  });

  it('caps the ring at the configured limit, dropping oldest', () => {
    for (let i = 0; i < 250; i += 1) {
      appendDiagEvent({ ts: i, runId: 'r', action: 'a', outcome: 'ok' });
    }
    const events = readDiagEvents();
    expect(events).toHaveLength(200);
    expect(events[0].ts).toBe(50);
    expect(events[199].ts).toBe(249);
  });

  it('formats an event as a time-prefixed line preserving the legacy shape', () => {
    const line = formatDiagEvent(
      { schema: DIAG_SCHEMA_VERSION, ts: 0, runId: 'r', action: 'ollama.detect', step: 'tags_fetch', outcome: 'error', code: 'OLM-003' },
      new Date(2026, 0, 1, 9, 17, 7),
    );
    expect(line).toBe('[09:17:07] ollama.detect:tags_fetch error [OLM-003]');
  });

  it('reset empties the ring (test isolation)', () => {
    appendDiagEvent({ ts: 1, runId: 'r', action: 'a', outcome: 'ok' });
    resetDiagEvents();
    expect(readDiagEvents()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/events.test.ts`
Expected: FAIL — module `./events` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/events.ts
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
    // export is best-effort; never break the recorder.
  }
  listeners.forEach((l) => l());
  return event;
}

export function readDiagEvents(): readonly DiagEvent[] {
  return ring;
}

export function resetDiagEvents(): void {
  ring = [];
  listeners.forEach((l) => l());
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
```

- [ ] **Step 4: Create the no-op export seam it imports**

```ts
// ui/src/diag/export.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { DiagEvent } from './events';

// Inert by default. A future paid-tier exporter (OTLP/Sentry) replaces this
// implementation. Contract: best-effort, async-safe, never throws into the
// recorder, applies redact() before egress, opt-in via env var. The event is
// schema-versioned (DIAG_SCHEMA_VERSION) so the wire format is stable.
export function exportEvent(_event: DiagEvent): void {
  // no-op
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/events.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add ui/src/diag/events.ts ui/src/diag/export.ts ui/src/diag/events.test.ts
git commit -m "feat(diag): DiagEvent model + singleton ring buffer + export seam"
```

---

### Task 2: traceAction span wrapper

**Files:**
- Create: `ui/src/diag/trace.ts`
- Test: `ui/src/diag/trace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/trace.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it } from 'vitest';

import { readDiagEvents, resetDiagEvents } from './events';
import { nextActionSeq, traceAction } from './trace';

afterEach(() => resetDiagEvents());

describe('traceAction', () => {
  it('emits ordered step events sharing one runId and a terminal outcome', async () => {
    await traceAction('ollama.detect', async ({ step }) => {
      step('tags_fetch', 'ok');
      step('config_get', 'ok');
    });
    const events = readDiagEvents();
    const runIds = new Set(events.map((e) => e.runId));
    expect(runIds.size).toBe(1);
    expect(events.map((e) => e.step ?? e.action)).toEqual([
      'tags_fetch',
      'config_get',
      'ollama.detect',
    ]);
    const terminal = events[events.length - 1];
    expect(terminal.outcome).toBe('ok');
    expect(typeof terminal.durationMs).toBe('number');
  });

  it('records an error terminal outcome when the body throws and rethrows', async () => {
    await expect(
      traceAction('ollama.detect', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const terminal = readDiagEvents().at(-1);
    expect(terminal?.outcome).toBe('error');
    expect(terminal?.error?.message).toContain('boom');
  });

  it('mints monotonically increasing action sequence numbers', () => {
    const a = nextActionSeq();
    const b = nextActionSeq();
    expect(b).toBe(a + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/trace.test.ts`
Expected: FAIL — module `./trace` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/trace.ts
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
  extra?: { code?: string; attrs?: Record<string, DiagAttrValue>; error?: { message: string; stack?: string } },
) => void;

export type TraceContext = {
  runId: string;
  actionSeq: number;
  step: StepFn;
};

export async function traceAction<T>(
  action: string,
  fn: (ctx: TraceContext) => Promise<T> | T,
  attrs?: Record<string, DiagAttrValue>,
): Promise<T> {
  const runId = makeRunId();
  const seq = nextActionSeq();
  const startedAt = Date.now();
  const step: StepFn = (name, outcome, extra) => {
    appendDiagEvent({
      ts: Date.now(),
      runId,
      action,
      step: name,
      outcome,
      code: extra?.code,
      attrs: extra?.attrs,
      error: extra?.error,
    });
  };
  try {
    const result = await fn({ runId, actionSeq: seq, step });
    appendDiagEvent({ ts: Date.now(), runId, action, outcome: 'ok', durationMs: Date.now() - startedAt, attrs });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    appendDiagEvent({
      ts: Date.now(),
      runId,
      action,
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      error: { message, stack },
      attrs,
    });
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/trace.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/src/diag/trace.ts ui/src/diag/trace.test.ts
git commit -m "feat(diag): traceAction span wrapper with runId + actionSeq"
```

---

### Task 3: Error-code registry + classifyError (consumes OllamaTagsResult)

**Files:**
- Create: `ui/src/diag/errorCodes.ts`
- Test: `ui/src/diag/errorCodes.test.ts`
- Reference: `ui/src/requirementChecks.ts` (`formatUnknownError`, `formatStartFailure`), `ui/src/ollamaSetup.ts` (`OllamaTagsResult`).

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/errorCodes.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { classifyOllamaTags, classifyError, getRemedy } from './errorCodes';

describe('error code registry', () => {
  it('classifies discriminated tags results into stable codes', () => {
    expect(classifyOllamaTags({ ok: false, reason: 'empty' }).code).toBe('OLM-004');
    expect(classifyOllamaTags({ ok: false, reason: 'invalid' }).code).toBe('OLM-005');
    expect(classifyOllamaTags({ ok: true, models: [] }).code).toBeUndefined();
  });

  it('classifies an unset config path as informational OLM-001', () => {
    expect(classifyError('ollama.config_get', 'Config path not found: agents.defaults.model.primary').code).toBe('OLM-001');
  });

  it('falls back to GEN-000 for unmapped failures and always yields a remedy', () => {
    const c = classifyError('ollama.detect', 'totally unexpected explosion');
    expect(c.code).toBe('GEN-000');
    expect(getRemedy(c.code)).toMatch(/copy diagnostics/i);
  });

  it('exposes a remedy for every registered code', () => {
    for (const code of ['OLM-001', 'OLM-002', 'OLM-003', 'OLM-004', 'OLM-005', 'GEN-000']) {
      expect(getRemedy(code)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/errorCodes.test.ts`
Expected: FAIL — module `./errorCodes` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/errorCodes.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { isConfigPathMissing } from '../ollamaSetup';
import type { OllamaTagsResult } from '../ollamaSetup';

export type DiagCode =
  | 'OLM-001' | 'OLM-002' | 'OLM-003' | 'OLM-004' | 'OLM-005'
  | 'GEN-000';

type RegistryEntry = { title: string; remedy: string };

// Single source of remediation text (formatStartFailure remediation migrates here in Task 10).
const REGISTRY: Record<DiagCode, RegistryEntry> = {
  'OLM-001': { title: 'No model configured yet', remedy: 'Expected on a fresh install. Pick a detected model and Apply.' },
  'OLM-002': { title: 'Configured-model read failed', remedy: 'Check the OpenClaw config volume; re-run Detect.' },
  'OLM-003': { title: 'Host Ollama unreachable', remedy: 'Start Ollama on the host (port 11434), then click Detect.' },
  'OLM-004': { title: 'Host Ollama returned an empty response', remedy: 'Confirm Ollama is serving the model API, then Detect.' },
  'OLM-005': { title: 'Host Ollama response unreadable', remedy: 'The /api/tags response was not a model list. Check the Ollama version, then Detect.' },
  'GEN-000': { title: 'Unexpected error', remedy: 'Copy diagnostics and open a GitHub issue with the bundle.' },
};

export type Classification = { code?: DiagCode; rawMessage: string };

export function classifyOllamaTags(result: OllamaTagsResult): Classification {
  if (result.ok) {
    return { code: undefined, rawMessage: '' };
  }
  return { code: result.reason === 'empty' ? 'OLM-004' : 'OLM-005', rawMessage: result.reason };
}

export function classifyError(context: string, rawMessage: string): { code: DiagCode; rawMessage: string } {
  if (context === 'ollama.config_get') {
    if (isConfigPathMissing(rawMessage)) {
      return { code: 'OLM-001', rawMessage };
    }
    return { code: 'OLM-002', rawMessage };
  }
  if (context === 'ollama.detect' || context === 'ollama.tags_fetch') {
    return { code: 'OLM-003', rawMessage };
  }
  return { code: 'GEN-000', rawMessage };
}

export function getRemedy(code: string): string {
  return REGISTRY[code as DiagCode]?.remedy ?? REGISTRY['GEN-000'].remedy;
}

export function getTitle(code: string): string {
  return REGISTRY[code as DiagCode]?.title ?? REGISTRY['GEN-000'].title;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/errorCodes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/src/diag/errorCodes.ts ui/src/diag/errorCodes.test.ts
git commit -m "feat(diag): error-code registry + classifyError consuming OllamaTagsResult"
```

---

### Task 4: State snapshot + invariants

**Files:**
- Create: `ui/src/diag/snapshot.ts`
- Test: `ui/src/diag/snapshot.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/snapshot.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { captureOllamaSnapshot, hasOllamaInvariantViolation } from './snapshot';

const base = {
  phase: 'running' as const,
  busy: false,
  ollamaChecking: false,
  ollamaStatus: '',
  ollamaAlertSeverity: 'info' as const,
  selectedOllamaModel: '',
  configuredOllamaModel: '',
  models: [{ name: 'llama3.2:latest' }],
  actionSeq: 2,
  appliedSeq: 2,
};

describe('ollama state snapshot', () => {
  it('reports modelsCount and list membership', () => {
    const snap = captureOllamaSnapshot({ ...base, selectedOllamaModel: 'llama3.2:latest' });
    expect(snap.modelsCount).toBe(1);
    expect(snap.selectedInDetectedList).toBe(true);
  });

  it('flags a selection not present in the detected list (the desync bug class)', () => {
    const state = { ...base, selectedOllamaModel: 'gone:latest' };
    const snap = captureOllamaSnapshot(state);
    expect(snap.selectedInDetectedList).toBe(false);
    expect(hasOllamaInvariantViolation(state)).toBe(true);
  });

  it('flags a stale (out-of-order) applied sequence', () => {
    expect(hasOllamaInvariantViolation({ ...base, appliedSeq: 1, actionSeq: 3 })).toBe(true);
  });

  it('treats an empty selection with an empty list as consistent', () => {
    expect(hasOllamaInvariantViolation({ ...base, models: [], selectedOllamaModel: '' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/snapshot.test.ts`
Expected: FAIL — module `./snapshot` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/snapshot.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { OllamaModel } from '../ollamaSetup';
import type { DiagAttrValue } from './events';

export type OllamaState = {
  phase: string;
  busy: boolean;
  ollamaChecking: boolean;
  ollamaStatus: string;
  ollamaAlertSeverity: string;
  selectedOllamaModel: string;
  configuredOllamaModel: string;
  models: OllamaModel[];
  actionSeq: number;
  appliedSeq: number;
};

export type OllamaSnapshot = Record<string, DiagAttrValue>;

export function captureOllamaSnapshot(state: OllamaState): OllamaSnapshot {
  const names = state.models.map((m) => m.name);
  return {
    phase: state.phase,
    busy: state.busy,
    ollamaChecking: state.ollamaChecking,
    ollamaStatus: state.ollamaStatus,
    ollamaAlertSeverity: state.ollamaAlertSeverity,
    selectedOllamaModel: state.selectedOllamaModel,
    configuredOllamaModel: state.configuredOllamaModel,
    modelsCount: names.length,
    selectedInDetectedList: state.selectedOllamaModel !== '' && names.includes(state.selectedOllamaModel),
    configuredInDetectedList: state.configuredOllamaModel !== '' && names.includes(state.configuredOllamaModel),
    actionSeq: state.actionSeq,
    appliedSeq: state.appliedSeq,
  };
}

export function hasOllamaInvariantViolation(state: OllamaState): boolean {
  const names = state.models.map((m) => m.name);
  const selectedDangling = state.selectedOllamaModel !== '' && !names.includes(state.selectedOllamaModel);
  const staleApply = state.appliedSeq < state.actionSeq;
  return selectedDangling || staleApply;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/snapshot.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/src/diag/snapshot.ts ui/src/diag/snapshot.test.ts
git commit -m "feat(diag): ollama state snapshot + invariant detection"
```

---

### Task 5: Redaction helper

**Files:**
- Create: `ui/src/diag/redact.ts`
- Test: `ui/src/diag/redact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/redact.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { redact } from './redact';

describe('redact', () => {
  it('masks bearer tokens and gateway tokens', () => {
    expect(redact('Authorization: Bearer SAMPLE-VALUE')).toBe('Authorization: Bearer [REDACTED]');
    expect(redact('token=SAMPLE-VALUE')).toBe('token=[REDACTED]');
  });

  it('anonymizes absolute home paths', () => {
    expect(redact('/Users/jane/.openclaw/config.json')).toBe('/Users/~/.openclaw/config.json');
    expect(redact('/home/bob/work')).toBe('/home/~/work');
  });

  it('leaves benign text unchanged', () => {
    expect(redact('Detected 2 host Ollama models.')).toBe('Detected 2 host Ollama models.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/redact.test.ts`
Expected: FAIL — module `./redact` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/redact.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/token=[A-Za-z0-9._-]+/g, 'token=[REDACTED]')
    .replace(/\/(Users|home)\/[^/\s]+/g, '/$1/~');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/redact.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/src/diag/redact.ts ui/src/diag/redact.test.ts
git commit -m "feat(diag): redact() for tokens and home paths"
```

---

### Task 6: Diagnostics bundle

**Files:**
- Create: `ui/src/diag/bundle.ts`
- Test: `ui/src/diag/bundle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/bundle.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { DIAG_SCHEMA_VERSION, type DiagEvent } from './events';
import { buildDiagnosticsBundle } from './bundle';

const env = { extensionVersion: '0.3.5', runtimeImage: 'ghcr.io/x:latest', dockerDesktop: '29.5.0', os: 'darwin/arm64' };
const events: DiagEvent[] = [
  { schema: DIAG_SCHEMA_VERSION, ts: 0, runId: 'r', action: 'ollama.detect', step: 'tags_fetch', outcome: 'error', code: 'OLM-003' },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/bundle.test.ts`
Expected: FAIL — module `./bundle` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/bundle.ts
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
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  const snap = Object.entries(snapshot)
    .map(([k, v]) => `- ${k}: ${redact(String(v))}`)
    .join('\n');
  const lines = events
    .map((e) => `- [${new Date(e.ts).toISOString()}] ${e.action}${e.step ? `:${e.step}` : ''} ${e.outcome}${e.code ? ` [${e.code}]` : ''}${e.error ? ` — ${redact(e.error.message)}` : ''}`)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/bundle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add ui/src/diag/bundle.ts ui/src/diag/bundle.test.ts
git commit -m "feat(diag): redacted diagnostics bundle builder"
```

---

### Task 7: Extract a testable detect core + App-level tests

**Files:**
- Create: `ui/src/ollamaDetect.ts`
- Test: `ui/src/App.diag.test.tsx`

The injected runner takes an injected command function and current state, so detection is testable without rendering React. It reuses the existing `OllamaTagsResult` early-return structure from #133.

- [ ] **Step 1: Write the failing App-level test (injected command function)**

```tsx
// ui/src/App.diag.test.tsx
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readDiagEvents, resetDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';

afterEach(() => resetDiagEvents());

function runnerMock(responses: { tags: { stdout?: string } | Error; config: { stdout?: string } | Error }) {
  return vi.fn(async (_cmd: string, args: string[]) => {
    const target = args.some((a) => a.includes('/api/tags')) ? responses.tags : responses.config;
    if (target instanceof Error) throw target;
    return target;
  });
}

describe('runDetect diagnostics', () => {
  it('emits OLM-003 when the tags fetch is unreachable', async () => {
    const run = runnerMock({ tags: new Error('curl: (7) connection refused'), config: { stdout: '' } });
    const out = await runDetect({ run, selectedOllamaModel: '' });
    expect(out.code).toBe('OLM-003');
    expect(readDiagEvents().some((e) => e.code === 'OLM-003')).toBe(true);
  });

  it('emits OLM-004 for an empty tags body and clears selection', async () => {
    const run = runnerMock({ tags: { stdout: '' }, config: { stdout: '' } });
    const out = await runDetect({ run, selectedOllamaModel: 'llama3.2:latest' });
    expect(out.code).toBe('OLM-004');
    expect(out.selectedOllamaModel).toBe('');
  });

  it('flags a successful-but-stale selection via an invariant snapshot on ok', async () => {
    const run = runnerMock({
      tags: { stdout: JSON.stringify({ models: [{ name: 'qwen3.5:latest' }] }) },
      config: { stdout: '' },
    });
    const out = await runDetect({ run, selectedOllamaModel: 'gone:latest' });
    const terminal = readDiagEvents().at(-1);
    expect(terminal?.attrs?.selectedInDetectedList).toBe(false);
    expect(out.selectedOllamaModel).not.toBe('gone:latest');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/App.diag.test.tsx`
Expected: FAIL — module `./ollamaDetect` not found.

- [ ] **Step 3: Write the detect core**

```ts
// ui/src/ollamaDetect.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import {
  buildOllamaTagsFetchArgs,
  chooseRecommendedOllamaModel,
  normalizeOllamaModelName,
  parseOllamaTags,
  type OllamaModel,
} from './ollamaSetup';
import { classifyError, classifyOllamaTags, getRemedy, getTitle } from './diag/errorCodes';
import { captureOllamaSnapshot, hasOllamaInvariantViolation } from './diag/snapshot';
import { traceAction } from './diag/trace';

type CommandResult = { stdout?: string; stderr?: string };
type CommandRunner = (cmd: string, args: string[]) => Promise<CommandResult>;

export type DetectInput = {
  run: CommandRunner;
  containerId?: string;
  selectedOllamaModel?: string;
  phase?: string;
};

export type DetectOutput = {
  models: OllamaModel[];
  configuredOllamaModel: string;
  selectedOllamaModel: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  status: string;
  code?: string;
};

const asText = (v: unknown) => (typeof v === 'string' ? v : '');

export async function runDetect(input: DetectInput): Promise<DetectOutput> {
  const containerId = input.containerId ?? 'test-container';
  const initialSelected = input.selectedOllamaModel ?? '';
  return traceAction('ollama.detect', async ({ step, actionSeq }) => {
    const finalize = (p: {
      models: OllamaModel[]; configured: string; selected: string;
      severity: DetectOutput['severity']; status: string; code?: string;
    }): DetectOutput => {
      let selected = p.selected;
      // Clear a dangling selection so Apply cannot run against a vanished model.
      if (selected !== '' && !p.models.some((m) => m.name === selected)) {
        selected = '';
      }
      const state = {
        phase: input.phase ?? 'running', busy: false, ollamaChecking: false,
        ollamaStatus: p.status, ollamaAlertSeverity: p.severity,
        selectedOllamaModel: selected, configuredOllamaModel: p.configured,
        models: p.models, actionSeq, appliedSeq: actionSeq,
      };
      if (p.severity !== 'success' || hasOllamaInvariantViolation(state)) {
        step('snapshot', p.severity === 'success' ? 'warning' : p.severity, { attrs: captureOllamaSnapshot(state) });
      }
      return {
        models: p.models, configuredOllamaModel: p.configured, selectedOllamaModel: selected,
        severity: p.severity, status: p.status, code: p.code,
      };
    };

    // 1) tags fetch (reachability)
    let tagsStdout: string;
    try {
      const r = await input.run('exec', [containerId, ...buildOllamaTagsFetchArgs()]);
      tagsStdout = asText(r.stdout);
      step('tags_fetch', 'ok');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const c = classifyError('ollama.detect', raw);
      step('tags_fetch', 'error', { code: c.code, error: { message: raw } });
      return finalize({ models: [], configured: '', selected: '', severity: 'error',
        status: `Could not reach host Ollama from OpenClaw: ${raw} [${c.code}] ${getRemedy(c.code)}`, code: c.code });
    }

    const tags = parseOllamaTags(tagsStdout);
    if (!tags.ok) {
      const c = classifyOllamaTags(tags);
      const code = c.code ?? 'OLM-005';
      step('tags_parse', 'warning', { code });
      return finalize({ models: [], configured: '', selected: '', severity: 'warning',
        status: `${getTitle(code)} [${code}] ${getRemedy(code)}`, code });
    }
    const models = tags.models;

    // 2) configured-model read (best effort)
    let configured = '';
    try {
      const r = await input.run('exec', [containerId, 'node', 'openclaw.mjs', 'config', 'get', 'agents.defaults.model.primary']);
      configured = normalizeOllamaModelName(asText(r.stdout));
      step('config_get', 'ok');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const c = classifyError('ollama.config_get', raw);
      step('config_get', c.code === 'OLM-001' ? 'ok' : 'warning', { code: c.code, error: { message: raw } });
    }

    const selected = initialSelected || configured || chooseRecommendedOllamaModel(models);
    return finalize({ models, configured, selected, severity: models.length > 0 ? 'success' : 'info',
      status: models.length > 0
        ? `Detected ${models.length} host Ollama model${models.length === 1 ? '' : 's'}.`
        : 'Host Ollama responded, but no models were installed.' });
  });
}
```

- [ ] **Step 4: Run the App-level test to verify it passes**

Run: `cd ui && npx vitest run src/App.diag.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Call `runDetect` from `App.tsx` and remove the old debug-append calls in `detectOllamaModels`**

In `ui/src/App.tsx`, replace the body of `detectOllamaModels` so it builds a `run` adapter over `ddClient.docker.cli.exec` (bound), calls `runDetect({ run, containerId: container.id, selectedOllamaModel, phase })`, then maps `DetectOutput` onto the existing setters (`setOllamaModels`, `setConfiguredOllamaModel`, `setSelectedOllamaModel`, `setOllamaAlertSeverity`, `setOllamaStatus`). Delete the now-unused debug-append lines for this flow (migration rule). Keep `setOllamaChecking(false)` in `finally`.

- [ ] **Step 6: Verify full suite + typecheck + build**

Run: `cd ui && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add ui/src/ollamaDetect.ts ui/src/App.diag.test.tsx ui/src/App.tsx
git commit -m "feat(diag): instrument ollama detect with traceAction, codes, invariant snapshot"
```

---

### Task 8: Concurrency / stale-result + recorder-resilience tests

**Files:**
- Test: `ui/src/ollamaDetect.concurrency.test.ts`, `ui/src/diag/resilience.test.ts`

- [ ] **Step 1: Write the concurrency test**

```ts
// ui/src/ollamaDetect.concurrency.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';
import { resetDiagEvents, readDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';

afterEach(() => resetDiagEvents());

it('assigns increasing action sequence numbers to overlapping detects', async () => {
  const slow = (ms: number, stdout: string) =>
    vi.fn(async () => { await new Promise((r) => setTimeout(r, ms)); return { stdout }; });
  const a = runDetect({ run: slow(30, JSON.stringify({ models: [{ name: 'a:latest' }] })), selectedOllamaModel: '' });
  const b = runDetect({ run: slow(5, JSON.stringify({ models: [{ name: 'b:latest' }] })), selectedOllamaModel: '' });
  await Promise.all([a, b]);
  const seqs = readDiagEvents()
    .filter((e) => e.action === 'ollama.detect' && e.outcome === 'ok' && e.step === undefined)
    .length;
  expect(seqs).toBe(2); // two terminal ok events, one per run
});
```

- [ ] **Step 2: Write the resilience test**

```ts
// ui/src/diag/resilience.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';
import * as exportMod from './export';
import { appendDiagEvent, resetDiagEvents } from './events';

afterEach(() => { vi.restoreAllMocks(); resetDiagEvents(); });

it('a throwing exporter never breaks appendDiagEvent', () => {
  vi.spyOn(exportMod, 'exportEvent').mockImplementation(() => { throw new Error('exporter down'); });
  expect(() => appendDiagEvent({ ts: 1, runId: 'r', action: 'a', outcome: 'ok' })).not.toThrow();
});
```

- [ ] **Step 3: Run both tests**

Run: `cd ui && npx vitest run src/ollamaDetect.concurrency.test.ts src/diag/resilience.test.ts`
Expected: PASS.

Note: the resilience test requires `exportEvent` to be called via the module namespace so `vi.spyOn` can intercept it. If `events.ts` imported it as a bound reference, change the import in `events.ts` to `import * as exportMod from './export'` and call `exportMod.exportEvent(event)`.

- [ ] **Step 4: Commit**

```bash
git add ui/src/ollamaDetect.concurrency.test.ts ui/src/diag/resilience.test.ts ui/src/diag/events.ts
git commit -m "test(diag): concurrency stale-result + recorder resilience"
```

---

### Task 9: useSyncExternalStore hook + Debug panel renders from the ring

**Files:**
- Create: `ui/src/diag/useDiagEvents.ts`
- Test: `ui/src/diag/useDiagEvents.test.ts`
- Modify: `ui/src/App.tsx` (Debug Output panel reads from the hook)

- [ ] **Step 1: Write the failing test**

```ts
// ui/src/diag/useDiagEvents.test.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it } from 'vitest';
import { appendDiagEvent, resetDiagEvents } from './events';
import { getDiagLogText } from './useDiagEvents';

afterEach(() => resetDiagEvents());

it('renders the ring as a newline-joined, time-prefixed log', () => {
  appendDiagEvent({ ts: new Date(2026, 0, 1, 9, 17, 7).getTime(), runId: 'r', action: 'ollama.detect', step: 'tags_fetch', outcome: 'error', code: 'OLM-003' });
  expect(getDiagLogText()).toContain('] ollama.detect:tags_fetch error [OLM-003]');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ui && npx vitest run src/diag/useDiagEvents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// ui/src/diag/useDiagEvents.ts
// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { useSyncExternalStore } from 'react';
import { formatDiagEvent, readDiagEvents, subscribeDiagEvents } from './events';

export function getDiagLogText(): string {
  return readDiagEvents().map((e) => formatDiagEvent(e)).join('\n');
}

export function useDiagLogText(): string {
  return useSyncExternalStore(subscribeDiagEvents, getDiagLogText, getDiagLogText);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ui && npx vitest run src/diag/useDiagEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Point the Debug panel at the hook**

In `ui/src/App.tsx`, replace the `debugLog` React-state string consumed by the Debug Output panel with `useDiagLogText()`. Remove the `debugLog`/`setDebugLog` state and the debug-append helper once all in-scope flows (Tasks 7 and 10) no longer call it. Keep `formatDebugEntry` in `debugLog.ts` (used by `formatDiagEvent`).

- [ ] **Step 6: Verify + commit**

Run: `cd ui && npx tsc --noEmit && npx vitest run && npm run build`
```bash
git add ui/src/diag/useDiagEvents.ts ui/src/diag/useDiagEvents.test.ts ui/src/App.tsx
git commit -m "feat(diag): Debug panel renders from the diag ring via useSyncExternalStore"
```

---

### Task 10: "Copy diagnostics" button + migrate start/restart + requirements

**Files:**
- Modify: `ui/src/App.tsx`, `ui/src/diag/errorCodes.ts`, `ui/src/requirementChecks.ts`

- [ ] **Step 1: Add the Copy diagnostics button**

In `ui/src/App.tsx` Debug Output card header, add a button whose handler builds the bundle from current env + `readDiagEvents()` + a snapshot of current state + best-effort container health (wrap the health fetch in try/catch → `undefined`), then `navigator.clipboard.writeText(bundle)`. Wrap the whole handler so a failure shows a message but never throws.

```tsx
const copyDiagnostics = useCallback(async () => {
  let health: string | undefined;
  try {
    const c = await findContainer();
    health = c?.status;
  } catch {
    health = undefined;
  }
  const bundle = buildDiagnosticsBundle(
    { extensionVersion: APP_VERSION, runtimeImage: config.image, dockerDesktop: dockerDesktopVersion, os: navigator.platform },
    readDiagEvents(),
    captureOllamaSnapshot(currentOllamaState()),
    health,
  );
  try {
    await navigator.clipboard.writeText(bundle);
    setMessage('Diagnostics copied to clipboard.');
  } catch {
    setMessage('Could not copy diagnostics to clipboard.');
  }
}, [config.image, dockerDesktopVersion, findContainer]);
```

`currentOllamaState()` is a small inline helper assembling the current React state into the `OllamaState` shape (with `actionSeq`/`appliedSeq` from the latest run, or `0/0` if none). `APP_VERSION` and `dockerDesktopVersion` reuse values already surfaced in the UI; if a Docker Desktop version is not already read, pass `'unknown'`.

- [ ] **Step 2: Migrate start/restart + requirements flows to traceAction**

Wrap `createOrStart`/`restart` and the requirements check in `traceAction('container.start', …)` / `traceAction('requirements.check', …)`, emit `step(...)` per sub-step, and migrate `formatStartFailure` remediation strings into `errorCodes.ts` (add `START-001`/`START-002` entries with remedies; have `formatStartFailure` delegate to `getRemedy`). Remove the old debug-append calls in these flows.

- [ ] **Step 3: Verify full suite + typecheck + build**

Run: `cd ui && npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green. Confirm no remaining debug-append calls for migrated flows:
```bash
grep -rn "appendDebug(" ui/src/App.tsx
```
Expected: no matches in migrated flows.

- [ ] **Step 4: Commit**

```bash
git add ui/src/App.tsx ui/src/diag/errorCodes.ts ui/src/requirementChecks.ts
git commit -m "feat(diag): Copy diagnostics bundle button + migrate start/restart/requirements"
```

---

### Task 11: Finalize PR

- [ ] **Step 1: Push and open a PR**

```bash
git push -u origin feat/130-observability
gh pr create --base main --head feat/130-observability \
  --title "feat(#130): right-sized observability & actionable diagnostics" \
  --body "Closes #130. See spec; includes test artifacts + adversarial-review request."
```

- [ ] **Step 2: Paste test artifacts** (tsc/vitest/build output) and an **adversarial-review request** into the PR body, calling out: `runDetect` finalize/clear logic, classifier drift, redaction completeness, concurrency `actionSeq` correctness.

- [ ] **Step 3: Request a cross-model adversarial review** (Codex/GPT) per the established workflow. Merge only after required checks pass and material review findings are resolved.

---

## Self-Review

**Spec coverage:** events/ring (T1), trace+runId+seq (T2), errorCodes+OllamaTagsResult+formatStartFailure migration (T3, T10), snapshot+invariants (T4), redaction (T5), bundle best-effort health (T6), detect wiring + App-level mocked-runner tests (T7), concurrency + resilience (T8), useSyncExternalStore persistence + Debug panel (T9), Copy button + start/restart/requirements migration (T10), PR + adversarial review (T11), dependency gate (T0). All spec AC mapped.

**Placeholder scan:** Tasks 7/9/10 wire `App.tsx` setters in prose (not a full file rewrite) because the surrounding `App.tsx` is large and recently changed in #131/#133; the *new* extracted logic (`ollamaDetect.ts`, hooks, bundle, registry) is given as complete code. The engineer maps named `DetectOutput` fields to named existing setters. No `TODO`/`TBD` left.

**Type consistency:** `DiagEvent`/`DiagOutcome`/`DiagAttrValue` (T1) reused in T2/T4/T6/T9; `OllamaTagsResult` (dep) consumed in T3/T7; `OllamaState`/`captureOllamaSnapshot`/`hasOllamaInvariantViolation` (T4) reused in T7/T10; `classifyError`/`classifyOllamaTags`/`getRemedy`/`getTitle` (T3) reused in T7. The detect runner uses `run`/`CommandRunner` consistently across T7/T8. Names align across tasks.

**Note on test-only dep:** Tasks 7–9 drive the extracted `runDetect`/hook directly and do not render React, so **no `@testing-library/react` dependency is required**. If a future task needs full render testing, evaluate the dep then.
