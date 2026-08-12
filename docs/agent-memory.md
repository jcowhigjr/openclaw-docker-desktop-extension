# Agent Memory Ledger

This ledger stores confirmed, project-specific lessons that should survive individual
ChatGPT or Codex tasks. It is evidence, not a second system prompt. `AGENTS.md` remains
the active operating contract and links here when a lesson needs more context.

## Promotion contract

A retrospective observation may be added here only when all of the following are true:

1. The failure or successful practice is supported by direct evidence.
2. The affected task type and project scope are explicit.
3. The corrective behavior is concrete and does not duplicate an existing rule.
4. A regression evaluation or explicit validation method exists.
5. The entry says when it should be reviewed or retired.

Do not promote transient tool outages, guesses, stylistic preferences, or conclusions
drawn only from the retro that proposes them. When evidence is incomplete, leave the
observation in the retro archive.

## Confirmed lessons

### Identify the execution surface before auditing activity

- **Status:** Confirmed
- **Added:** 2026-08-12
- **Scope:** Reviews of project activity, scheduled work, CI runs, and agent automation
- **Failure:** A request about visible ChatGPT/Codex scheduled tasks was initially
  interpreted as a request to audit GitHub Actions. The resulting report described a
  real system, but not the system the user had asked about.
- **Evidence:** The visible run names were `OpenClaw AM`, `OpenClaw Midday`, and
  `OpenClaw PM`. Inspection of the corresponding Codex automation history showed
  repeated blocker checks and no durable repository delivery. A separate reviewer
  confirmed the scope correction while noting that the same-session retro was not an
  independent or representative evidence sample.
- **Correct behavior:** Before counting runs or describing their value, identify the
  execution surface from the user's artifact and vocabulary. Keep Codex tasks,
  repository automation, GitHub Actions, and external delivery systems in separate
  evidence ledgers. If the surface remains ambiguous, report that ambiguity instead of
  substituting a familiar system.
- **Validation:** Run the scenario in
  `evals/automation-activity-audit.md`. A passing response must identify the visible
  surface, separate execution success from durable delivery, and avoid unsupported
  GitHub Actions claims.
- **Review when:** The ChatGPT activity interface or Codex automation model changes.

### Count outcomes separately from successful executions

- **Status:** Confirmed
- **Added:** 2026-08-12
- **Scope:** Scheduled Codex work and recurring project-maintenance automation
- **Failure:** Repeated runs that rediscovered the same unchanged blocker appeared as
  successful activity even though they produced no commit, pull request update, issue
  update, test result, release, or product change.
- **Evidence:** Multiple scheduled OpenClaw lanes reported the same blocker while the
  repository's durable state remained unchanged. The lanes were paused without losing
  their schedules or configuration.
- **Correct behavior:** Report both run health and durable output. Suppress or pause a
  lane after an unchanged blocker, and resume it only after a relevant external state
  change or explicit user action.
- **Validation:** The activity-audit evaluation must reject run count alone as evidence
  of value and enumerate the durable outputs that were actually observed.
- **Review when:** Automations gain a native event trigger or deduplication contract.

## Entry template

```markdown
### Concise lesson title

- **Status:** Proposed | Confirmed | Retired
- **Added:** YYYY-MM-DD
- **Scope:** Affected tasks and project boundary
- **Failure:** What happened, stated without speculation
- **Evidence:** Independent or directly observable support
- **Correct behavior:** The smallest actionable correction
- **Validation:** Regression evaluation, executable check, or inspection method
- **Review when:** Expiry or reconsideration condition
```
