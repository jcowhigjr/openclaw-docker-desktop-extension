# Right-Sized Observability & Actionable Diagnostics — Design (v2)

- **Issue:** [#130](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/130)
- **Date:** 2026-06-04
- **Status:** Approved design (v2, incorporates GPT-5.5 spec review), pre-implementation
- **Depends on:** PR [#131](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/131) and PR [#133](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/133) — see **Dependencies & Sequencing**.

## Context

The extension orchestrates several moving parts from a Docker Desktop webview:
container lifecycle, the `socat` host bridge, gateway-token bootstrap, host
Ollama reachability, exec-mode policy. When a step fails, the user sees an
opaque banner (e.g. "Could not reach host Ollama from OpenClaw: …") and the only
observability is a single flat, time-prefixed string capped at 12000 chars
(`ui/src/debugLog.ts` `appendDebugEntry`) rendered in the Debug Output panel.

The real cost is not crashes — it is **state/orchestration issues that unit
tests miss**. Two surfaced this week: the Ollama detect failure from an unset
config path (#129), and a stale `selectedOllamaModel` leaving "Apply and
Restart" enabled after a failed re-detect (found by adversarial review on #133,
not by tests). Both are state desyncs across the React-state ↔ `ddClient.exec`
boundary.

**Goal:** turn "something broke" into "which step failed, in what state, why,
next action" — fast, locally and in sandboxes — with tight tech-debt and no
heavyweight infrastructure.

## Dependencies & Sequencing (read first — this is the risky part)

Branch/PR chain at design time:

```
main
 └─ fix/ollama-detect-config-path        PR #131 (open)
     └─ fix/132-ollama-tags-parse-error  PR #133 (open, stacked on #131)
```

Implementation of this design **must not branch from `main` as it stands today**
because:

1. **#133 provides `parseOllamaTags` → `OllamaTagsResult` (discriminated `empty`
   vs `invalid`).** Without it, error codes `OLM-004` (empty) and `OLM-005`
   (invalid) cannot be distinguished — on `main` both collapse to `[]`.
2. **#131/#133 add the cleared-selection and warning-severity behavior** that the
   state-desync snapshots are meant to observe and regression-test.

**Required sequencing:**

- **Preferred:** merge #131, then #133, to `main`. Then create the
  implementation branch `feat/130-observability` **from `main`**.
- **If work must start before merge:** branch `feat/130-observability` **from
  `fix/132-ollama-tags-parse-error`** (the tip of the stack), and rebase it onto
  `main` once #131 and #133 land. Do **not** open the implementation PR for
  merge until #131 and #133 are merged; keep it draft.
- The implementation plan (writing-plans) must begin with a **gate task** that
  verifies `OllamaTagsResult` exists in `ui/src/ollamaSetup.ts` and the cleared-
  selection behavior is present in `detectOllamaModels` before any code is
  written. If absent, stop and resolve the dependency first.
- If #131/#133 change materially during review, rebase and re-run the gate task
  before continuing.

## Scope & Non-Goals

**First slice (this change):** structured recorder + trace wrapper + error-code
registry + state snapshot + diagnostics bundle, wired into a **bounded set of
flows**: Ollama detect, start/restart, requirements check. Bundle is built from
**already-known in-memory state** (container health fetch is best-effort only).

**Deferred to later slices:** migrating the remaining flows (`createOrStart`
internals, `runAndPoll`, `readToken`, `openBrowser`, `applyOllamaSetup`, update,
exec-mode) to `traceAction`; the OTLP/Sentry exporter implementation.

**Explicitly out of scope (YAGNI / future paid tier):** an OpenTelemetry
collector, Jaeger/Grafana, metrics, real OTLP/Sentry egress, i18n of remedy
strings (centralizing them is enough for now). The design leaves a single,
inert, env-gated seam so these become additive later.

**Why not `@opentelemetry/*` now:** the webview is not a long-running server, so
there is nothing to auto-instrument and nowhere to send spans without also
standing up a collector + viewer. We adopt OTEL *semantics* (name, attributes,
status, start time, duration, correlation id) backed by a small in-repo recorder.
The layer is **OTEL-shaped and export-adaptable**, not a drop-in OTEL SDK.

## Architecture

New UI code under `ui/src/diag/`. Each unit is independently testable; the
recorder is a module-level singleton (see **Persistence model**).

### 1. Event model & ring buffer — `ui/src/diag/events.ts`
Single source of truth, replacing the flat string.

```ts
const DIAG_SCHEMA_VERSION = 1;

type DiagOutcome = 'ok' | 'warning' | 'error';
type DiagAttrValue = string | number | boolean | string[];
type DiagEvent = {
  schema: typeof DIAG_SCHEMA_VERSION;
  ts: number;            // epoch ms
  runId: string;         // correlation id for one action run (OTEL traceId analog)
  action: string;        // span name, e.g. 'ollama.detect'
  step?: string;         // e.g. 'tags_fetch' | 'config_get'
  outcome: DiagOutcome;
  code?: string;         // stable error code, e.g. 'OLM-003'
  durationMs?: number;
  attrs?: Record<string, DiagAttrValue>;
  error?: { message: string; stack?: string }; // export-adaptable (Sentry later)
};
```
`runId` and `schema` are present from day one so a future exporter needs no
schema migration. A capped ring buffer (last 200 events) with pure
append/read/clear/reset (`reset()` for test isolation). Debug panel renders via
`formatDiagEvent`, preserving the current `[HH:MM:SS] message` format.

### 2. Action span wrapper — `ui/src/diag/trace.ts`
`traceAction(action, fn, attrs?)` mints one `runId`, records start, runs `fn`
(which receives `step(name, outcome, { code?, attrs?, error? })`), times it, and
records the terminal outcome with the same `runId`. **Concurrency:** the wrapper
exposes the `runId` and a monotonically increasing `actionSeq`; flows that mutate
shared UI state record `appliedSeq` so a stale (out-of-order) result is visible
and can be suppressed (see #3). Recorder calls are wrapped so a diagnostics bug
**cannot throw into the user flow**.

### 3. State snapshot & invariants — `ui/src/diag/snapshot.ts`
Pure `captureOllamaSnapshot(state)` returning typed attrs:
`{ phase, busy, ollamaChecking, ollamaStatus, ollamaAlertSeverity,
selectedOllamaModel, configuredOllamaModel, modelsCount, selectedInDetectedList,
configuredInDetectedList, actionSeq, appliedSeq }`.

**Snapshots are captured on every terminal outcome — `error`, `warning`, AND
`ok` when an invariant is violated** (e.g. `selectedOllamaModel` set but not in
the detected list, or `appliedSeq < actionSeq`). This directly closes the gap
the review raised: the `setSelectedOllamaModel((current) => current || …)` merge
in `detectOllamaModels` can preserve a stale selection even on a *successful*
detect; a failure-only snapshot would miss it. No hidden globals — state is
passed in, so it is unit-testable.

### 4. Error-code → remediation registry — `ui/src/diag/errorCodes.ts`
Central map keyed by stable code; the **single source of remediation text**:

```ts
{ code: 'OLM-003', remedyKey: 'ollama.unreachable',
  title: 'Host Ollama unreachable',
  remedy: 'Start Ollama on the host (port 11434), then click Detect.' }
```
`classifyError(context, err): { code; rawMessage; remedyKey }` sits on top of
`formatUnknownError` (`ui/src/requirementChecks.ts`) and the structured
`OllamaTagsResult` from #133 (so `OLM-004`/`OLM-005` are classified from the
discriminated `reason`, not brittle string matching). Codes:
- `OLM-001` config path unset (informational, not error)
- `OLM-002` configured-model read failed (unexpected)
- `OLM-003` tags fetch / reachability failed
- `OLM-004` `/api/tags` empty (`reason: 'empty'`)
- `OLM-005` `/api/tags` unreadable/invalid (`reason: 'invalid'`)
- container/start/token/exec-mode codes added as those flows migrate.
- `GEN-000` fallback for any unmapped failure (never a dead end).

**Drift control:** existing remediation logic in `formatStartFailure`
(`requirementChecks.ts`) is **migrated into this registry** so there is one
source of truth. Banners render `message [CODE]` + the one-line remedy.

### 5. Diagnostics bundle — `ui/src/diag/bundle.ts` + "Copy diagnostics" button
Pure `buildDiagnosticsBundle(env, events, snapshot)` → markdown: versions
(extension, runtime image tag, Docker Desktop, OS/arch), last N events, current
snapshot, and container health **(best-effort — a failed health fetch degrades
gracefully, never blocks the copy)**. **Redaction policy:** the bundle and any
exported event run through a `redact()` pass that strips/anonymizes tokens,
absolute home paths, and gateway secrets before leaving the recorder. Output is
copied to the clipboard, ready to paste into a GitHub issue.

### 6. Exporter seam (deferred, designed-in) — `ui/src/diag/export.ts`
`exportEvent(event)` hook the ring buffer calls. Default = no-op. Contract for
the future implementation: **best-effort, async-safe, never throws into the
recorder, applies `redact()`, opt-in via env var** (OpenWebUI-style
`ENABLE_OTEL` / `OTEL_EXPORTER_OTLP_ENDPOINT`), with backpressure handled by the
adapter. Schema is versioned (`DIAG_SCHEMA_VERSION`) so the wire format is
stable. Documented as the paid-tier upgrade path.

## Persistence model

The recorder is a **module-level singleton ring buffer** (in-memory), not React
state — so events survive component remounts and are observable from non-React
code. React subscribes via a small `useSyncExternalStore` hook for the Debug
panel. `reset()` clears it for test isolation. The old `debugLog` React-state
string is removed once its flows are migrated (see migration rule). Hot-reload
in dev may reset the singleton; that is acceptable and noted.

## Data Flow

```
user action
  → traceAction('ollama.detect', async ({ step, runId, actionSeq }) => {
       step('tags_fetch', ...)   // ddClient.exec curl /api/tags  → OllamaTagsResult
       step('config_get', ...)   // ddClient.exec openclaw config get
     })
  → each step appends a DiagEvent (with runId/seq) to the ring (+ exportEvent no-op)
  → on terminal outcome: classifyError → code; captureOllamaSnapshot → attrs
       (always on error/warning; on ok only if an invariant is violated)
  → banner shows message [CODE] + remedy
  → Debug panel renders events; "Copy diagnostics" emits the redacted bundle
```

## Error Handling

- `classifyError` always returns a code; unmapped → `GEN-000` with a "copy
  diagnostics and open an issue" remedy.
- Recorder append/snapshot/classify/export and the bundle/clipboard path are all
  wrapped: a diagnostics failure must never break detect/start/etc.
- `formatUnknownError` remains the raw-text extractor; `classifyError` sits on top.

## Testing Strategy (boundary tests are hard requirements, not "where feasible")

Pure module tests:
- **events/ring**: append cap, ordering, clear/reset, schema/runId present.
- **trace**: ordered `(step, outcome)` sequence; duration recorded; one stable
  `runId` per run; `actionSeq` increments.
- **errorCodes**: each known input → expected code + remedy; `OLM-004` vs
  `OLM-005` derived from `OllamaTagsResult.reason`; unmapped → `GEN-000`.
- **snapshot**: given state, expected typed attrs; **regression test asserting a
  failed detect snapshot shows `selectedOllamaModel === ''`** and a
  successful-but-changed-list detect flags `selectedInDetectedList === false`.
- **bundle**: deterministic redacted markdown for fixed env/events/snapshot;
  health-fetch failure degrades gracefully.

App-level tests (new; required — repo currently has none):
- Mocked `ddClient.docker.cli.exec` driving `detectOllamaModels` through:
  success, empty tags, invalid tags, config-get failure, unreachable Ollama —
  asserting the emitted event/code sequence and the resulting banner.
- **Concurrency/stale-result test:** two detects finishing out of order; assert
  `appliedSeq`/`actionSeq` make the stale result visible and it is not applied
  over newer state. Include the `phase === 'running'` auto-detect path.
- **Recorder resilience:** forced failures in append/classify/snapshot/export/
  clipboard do not break the user flow.

All via the existing Vitest setup; add `@testing-library/react` only if needed
for the App-level render tests (evaluate during planning; prefer driving the
exported callbacks directly if that avoids a new dep).

## Migration / Tech-Debt Posture

- `appendDebugEntry` becomes a thin render helper over `formatDiagEvent`.
- **Migration rule:** a flow is "migrated" only when its old `appendDebug(string)`
  calls are **removed** and replaced by `traceAction`/`step`. No mixed state per
  flow. The "single source of truth" AC is satisfied per-flow as each migrates;
  the flat-string React state is deleted when the last in-scope flow migrates.
- One standard store (the singleton ring buffer); no parallel string log.
- Zero new runtime dependencies (test-only dep evaluated separately).

## Rollout Order (for the implementation plan)

0. **Gate:** confirm #131/#133 merged (or branch from #133 tip); verify
   `OllamaTagsResult` + cleared-selection present. Stop if absent.
1. `diag/events.ts` + `diag/trace.ts` + tests (no UI change).
2. `diag/errorCodes.ts` + `classifyError` (consuming `OllamaTagsResult`) +
   migrate `formatStartFailure` remediation + tests.
3. Wire Ollama detect to `traceAction` + codes + banner `[CODE]`/remedy; remove
   its old `appendDebug` calls. App-level mocked-exec tests.
4. `diag/snapshot.ts` + invariant snapshots; regression + concurrency tests.
5. `diag/bundle.ts` + `redact()` + "Copy diagnostics" button; bundle tests.
6. Migrate start/restart + requirements flows; remove their string logs.
7. `diag/export.ts` no-op seam + docs note on the deferred OTLP/paid-tier path.

## Acceptance Criteria

- [ ] Implementation branch is based on #133 (or `main` post-merge); a gate
      verified `OllamaTagsResult` + cleared-selection before coding.
- [ ] Structured `DiagEvent` (with `schema`, `runId`) ring buffer is the source
      of truth for migrated flows; Debug panel renders from it with the current
      time-prefixed format preserved.
- [ ] In-scope flows (Ollama detect, start/restart, requirements) are wrapped in
      `traceAction` and emit ordered per-step events with outcome + duration +
      `runId`; their old string `appendDebug` calls are removed.
- [ ] Every in-scope failure banner shows a stable `[CODE]` + one-line remedy;
      `OLM-004`/`OLM-005` derive from `OllamaTagsResult.reason`; unmapped →
      `GEN-000`. `formatStartFailure` remediation lives in the registry.
- [ ] State snapshots are captured on error/warning and on `ok` when an
      invariant is violated; regression test proves the stale-selection desync
      (failed detect → `selectedOllamaModel === ''`; changed-list success →
      `selectedInDetectedList === false`) is visible.
- [ ] App-level mocked-`ddClient` tests cover detect success/empty/invalid/
      config-fail/unreachable; a concurrency test proves stale-result
      visibility; recorder-resilience tests prove diagnostics failures never
      break a user flow.
- [ ] "Copy diagnostics" produces a deterministic, **redacted** markdown bundle
      (versions + last N events + snapshot + best-effort container health).
- [ ] No new runtime dependencies; `exportEvent` is an inert, env-gated,
      redacted, best-effort, schema-versioned seam.
- [ ] Full Vitest suite + `tsc --noEmit` + `npm run build` green; PR carries
      test artifacts and a cross-model adversarial review; PR stays **draft**
      until #131 and #133 are merged.
