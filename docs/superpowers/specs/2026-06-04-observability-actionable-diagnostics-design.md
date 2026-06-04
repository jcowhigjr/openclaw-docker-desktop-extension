# Right-Sized Observability & Actionable Diagnostics — Design

- **Issue:** [#130](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/130)
- **Date:** 2026-06-04
- **Status:** Approved design, pre-implementation

## Context

The extension orchestrates several moving parts from a Docker Desktop webview:
container lifecycle, the `socat` host bridge, gateway-token bootstrap, host
Ollama reachability, exec-mode policy. When any step fails, the user today sees
an opaque banner (e.g. "Could not reach host Ollama from OpenClaw: …") and the
only observability is a single flat, time-prefixed string capped at 12000 chars
(`ui/src/debugLog.ts` `appendDebugEntry`) rendered in the Debug Output panel.

This is the same anti-pattern other extensions show (LocalStack's "Could not
connect to a licensed instance"). The real cost is not crashes — it is
**state/orchestration issues that unit tests miss**. Two surfaced this week:
the Ollama detect failure caused by an unset config path (#129), and a stale
`selectedOllamaModel` leaving "Apply and Restart" enabled after a failed
re-detect (found by adversarial review on #133, not by tests). Both are
state desyncs across the React-state ↔ `ddClient.exec` boundary.

**Goal:** turn "something broke" into "here is which step failed, in what
state, why, and the next action" — fast, on the user's local machine and in
sandboxes — with tight tech-debt and no heavyweight infrastructure.

## Scope & Non-Goals

**In scope (this change):** a zero-runtime-dependency, OTEL-*shaped* diagnostics
layer entirely inside the existing UI/runtime, replacing the flat debug string.

**Explicitly deferred (YAGNI / future paid tier):** OTLP exporter, an
OpenTelemetry collector, Jaeger/Grafana, metrics, Sentry, and any external
egress. The design leaves a single seam (see "Exporter seam") so these become
additive later, gated by an env var like OpenWebUI's `ENABLE_OTEL` /
`OTEL_EXPORTER_OTLP_ENDPOINT`, without a rewrite.

**Why not adopt `@opentelemetry/*` now:** the webview is not a long-running
server, so there is nothing to auto-instrument and nowhere to send spans
without also standing up a collector + viewer. The SDK's cost (bundle size,
fast semver churn) buys nothing for single-user local diagnostics. We adopt the
OTEL *semantics* (span name, attributes, status, start time, duration) backed by
a ~100-line in-repo recorder, so a real exporter is a drop-in later.

## Architecture

Six small units, each independently testable. All new UI code lives under
`ui/src/diag/`.

### 1. Event model & ring buffer — `ui/src/diag/events.ts`
The single source of truth, replacing the flat string. OTEL-shaped record:

```ts
type DiagOutcome = 'ok' | 'warning' | 'error';
type DiagEvent = {
  ts: number;            // epoch ms
  action: string;        // span name, e.g. 'ollama.detect'
  step?: string;         // e.g. 'tags_fetch' | 'config_get'
  outcome: DiagOutcome;
  code?: string;         // stable error code, e.g. 'OLM-003'
  durationMs?: number;
  attrs?: Record<string, string | number | boolean>;
};
```
A capped ring buffer (e.g. last 200 events) holds them. Pure module: append,
read, clear. No React. The Debug panel renders from this (formatting identical
to today via a `formatDiagEvent` that mirrors `formatDebugEntry`).

### 2. Action span wrapper — `ui/src/diag/trace.ts`
`traceAction(action, fn, attrs?)`: records start, runs `fn` (which receives a
`step(name, outcome, {code, attrs})` callback), times it, records terminal
outcome. One correlation id per action run so all steps of a flow group
together. Wraps each user flow in `App.tsx`: detect, start, stop, update,
exec-mode, token bootstrap.

### 3. Error-code → remediation registry — `ui/src/diag/errorCodes.ts`
Central map keyed by stable code:

```ts
{ code: 'OLM-003', title: 'Host Ollama unreachable',
  remedy: 'Start Ollama on the host (port 11434), then click Detect.' }
```
A `classifyError(context, err)` helper maps known failures to a code, reusing
the cause classes the recent fixes created ad hoc:
- `OLM-001` config path unset (expected; informational, not error)
- `OLM-002` configured-model read failed (unexpected)
- `OLM-003` tags fetch / reachability failed
- `OLM-004` `/api/tags` response empty
- `OLM-005` `/api/tags` response unreadable/invalid
- plus container/start/token/exec-mode codes as those flows are wrapped.

Banners render `message [CODE]` and show the one-line remedy. Codes are stable
and greppable; each maps to a docs anchor for the "Learn more" link.

### 4. State snapshot on failure — `ui/src/diag/snapshot.ts`
On any non-ok terminal outcome, capture a typed snapshot of the relevant UI
state — `{ phase, ollamaChecking, selectedOllamaModel, configuredOllamaModel,
ollamaAlertSeverity, executionMode, appliedExecutionMode }` — into the event's
`attrs`. **This is the direct hit on "state issues we miss in tests":** the
desync (e.g. selected ≠ configured after a cleared list) is visible at the
moment it happens. The snapshot is a pure function of passed-in values (no
hidden globals) so it is unit-testable.

### 5. Diagnostics bundle — `ui/src/diag/bundle.ts` + a "Copy diagnostics" button
Pure `buildDiagnosticsBundle(env, events, snapshot)` → markdown string:
versions (extension, runtime image tag, Docker Desktop, OS/arch), last N events,
current state snapshot, latest container health. The button copies it to the
clipboard, ready to paste into a GitHub issue — closing the loop with the
issue-first workflow.

### 6. Exporter seam (deferred, designed-in) — `ui/src/diag/export.ts`
A no-op `exportEvent(event)` hook the ring buffer calls. Default implementation
does nothing. A future OTLP/Sentry exporter is wired here, gated by an env var,
without touching call sites. Documented as the paid-tier upgrade path.

## Data Flow

```
user action
  → traceAction('ollama.detect', async (step) => {
       step('tags_fetch', ...)        // ddClient.exec curl /api/tags
       step('config_get', ...)        // ddClient.exec openclaw config get
     })
  → each step appends a DiagEvent to the ring buffer (+ exportEvent no-op)
  → on failure: classifyError → code; captureSnapshot → attrs
  → banner shows message [CODE] + remedy
  → Debug panel renders events; "Copy diagnostics" emits the bundle
```

## Error Handling

- `classifyError` always returns a code; an unmapped failure yields a generic
  `GEN-000` with a "copy diagnostics and open an issue" remedy (never a dead
  end).
- The recorder must never throw into a user flow: append/snapshot/classify are
  wrapped so a diagnostics bug cannot break detect/start/etc.
- Existing `formatUnknownError` (`ui/src/requirementChecks.ts`) remains the
  raw-text extractor; `classifyError` sits on top of it.

## Testing Strategy

The structured layer is itself the test oracle for the state bugs we miss:
- **events/ring**: append caps, ordering, clear — pure unit tests.
- **trace**: a flow emits the expected ordered `(step, outcome)` sequence;
  duration recorded; correlation id stable within a run.
- **errorCodes**: each known input → expected code + remedy; unmapped →
  `GEN-000`.
- **snapshot**: given UI state, produces the expected typed attrs; in particular
  a regression test asserting that a failed detect snapshot shows
  `selectedOllamaModel === ''` (the #133 bug class).
- **bundle**: deterministic markdown given fixed env/events/snapshot.
- **App-level (where feasible)**: assert detect/start emit the documented event
  sequence — turning "moving parts" into assertions.

All via the existing Vitest setup; no new test infra.

## Migration / Tech-Debt Posture

- `appendDebugEntry` becomes a thin render helper over `formatDiagEvent`; the
  Debug panel keeps its current look. Call sites move from `appendDebug(string)`
  to `step(...)` / `traceAction(...)` incrementally, flow by flow, so the change
  can land in reviewable slices rather than one large diff.
- One standard store (the ring buffer); no parallel string log to drift.
- Zero new runtime dependencies. Optional `loglevel` was considered and
  rejected as not worth a dependency for this size.

## Rollout Order (for the implementation plan)

1. `diag/events.ts` + `diag/trace.ts` + tests (no UI change yet).
2. `diag/errorCodes.ts` + `classifyError` + tests; wire the Ollama detect flow
   (highest-value, already-understood failure surface) to emit codes + render
   `[CODE]` + remedy.
3. `diag/snapshot.ts` + failure snapshots; regression test for the stale-
   selection class.
4. `diag/bundle.ts` + "Copy diagnostics" button.
5. Migrate remaining flows (start/stop/update/exec-mode/token) to `traceAction`.
6. `diag/export.ts` no-op seam + docs note on the deferred OTLP/paid-tier path.

## Acceptance Criteria

- [ ] Structured `DiagEvent` ring buffer is the single source of truth; Debug
      panel renders from it with the current time-prefixed format preserved.
- [ ] Each major user flow is wrapped in `traceAction` and emits ordered
      per-step events with outcome + duration + correlation id.
- [ ] Every user-facing failure banner shows a stable `[CODE]` and a one-line
      remedy; unmapped failures fall back to `GEN-000`, never a dead end.
- [ ] On failure, a typed state snapshot is captured into the event; a
      regression test asserts the stale-selection desync is visible.
- [ ] A "Copy diagnostics" action produces a deterministic markdown bundle
      (versions + last N events + snapshot + container health) to the clipboard.
- [ ] No new runtime dependencies; OTLP/Sentry export is a documented, env-gated
      seam that is inert by default.
- [ ] Full Vitest suite + `tsc --noEmit` + `npm run build` green; PR carries
      test artifacts and a cross-model adversarial review.
