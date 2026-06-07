# release-quality-gates

## Purpose

Define CI and release-checklist guards that enforce documentation freshness against source changes — keeping committed screenshots in sync with the shipped UI so docs and the marketplace listing do not silently drift.

## Requirements

### Requirement: UI source changes are gated against screenshot freshness

The release verification path SHALL include a guard that detects when UI source files have changed without an accompanying screenshot update, so documentation and the marketplace listing do not silently drift from the shipped UI. The guard MUST evaluate a commit range, MUST default that range to the last release tag through `HEAD`, and MUST allow the range to be overridden via environment variables for pull-request and CI contexts.

The guard MUST treat changes under the UI source tree (`ui/src/`) as visual-relevant and screenshots under `docs/` (image files: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) as the documentation surface. The guard MUST exit non-zero when visual-relevant source changed in the range but no screenshot under `docs/` was added or modified in the same range, unless an opt-out applies. A deleted screenshot MUST NOT satisfy the guard. A diff error (unresolvable range) MUST fail closed (non-zero), not be treated as "no changes".

#### Scenario: UI source changed without a screenshot update

- **WHEN** the evaluated commit range contains changes to files under `ui/src/` and no image file under `docs/` was added or modified in that range
- **AND** no opt-out trailer is present for those changes
- **THEN** the guard SHALL exit non-zero and report which UI files changed without a corresponding screenshot update

#### Scenario: UI source changed with a screenshot update

- **WHEN** the evaluated commit range contains changes to files under `ui/src/` and at least one image file under `docs/` was added or modified in that range
- **THEN** the guard SHALL exit zero

#### Scenario: No UI source changed

- **WHEN** the evaluated commit range contains no changes to files under `ui/src/`
- **THEN** the guard SHALL exit zero regardless of whether any screenshot changed

#### Scenario: Default range is the last release tag to HEAD

- **WHEN** the guard runs without an explicit range override
- **THEN** it SHALL compare the most recent release tag against `HEAD`
- **AND** when no release tag exists it SHALL fall back to a safe default (no failure) rather than erroring

### Requirement: Explicit opt-out for changes with no visual diff

The guard SHALL provide an explicit, auditable opt-out so that behavior-only UI changes (no visual difference) are not blocked. The opt-out MUST be expressed in commit metadata within the evaluated range using a trailer of the form `Screenshots-Not-Needed: <reason>`, and the reason MUST be non-empty. The opt-out scan MUST only consider commits reachable from the head side of the range, so a trailer on the base branch cannot waive an unrelated head-side change.

#### Scenario: Opt-out trailer present with a reason

- **WHEN** the evaluated commit range changes files under `ui/src/` with no screenshot update
- **AND** a head-side commit in the range contains a `Screenshots-Not-Needed:` trailer with a non-empty reason
- **THEN** the guard SHALL exit zero and report that the screenshot requirement was waived, including the stated reason

#### Scenario: Opt-out trailer present without a reason

- **WHEN** a commit in the range contains a `Screenshots-Not-Needed:` trailer whose reason is empty or whitespace-only
- **THEN** the guard SHALL treat the opt-out as invalid and exit non-zero

#### Scenario: Opt-out trailer present only on the base branch

- **WHEN** a `Screenshots-Not-Needed:` trailer exists only on the base branch of the range, and a head-side commit changes `ui/src/` with no screenshot update
- **THEN** the guard SHALL NOT treat the base-side trailer as a waiver and SHALL exit non-zero

### Requirement: Onboarding screens are screenshot-reachable in demo mode

To keep screenshots fresh, demo mode SHALL be able to render each first-run onboarding phase deterministically via a query flag, so the capture pipeline can screenshot new onboarding screens without live first-run state. The flag MUST be effective only in demo mode so it cannot override real first-run state in production.

#### Scenario: Demo flag forces the fork onboarding phase

- **WHEN** the UI loads in demo mode with the onboarding flag set to the fork phase (e.g. `?demo=1&onboarding=fork`)
- **THEN** the UI SHALL render the fork onboarding card regardless of the underlying demo state

#### Scenario: Capture pipeline screenshots the forced phase

- **WHEN** the capture script targets the demo URL with the onboarding flag
- **THEN** it SHALL produce a valid screenshot of the requested onboarding screen

### Requirement: Guard is wired into the release verification path

The guard SHALL be invocable through a Makefile target and SHALL be part of the `test-pre-push` aggregate target and the Build workflow, consistent with existing `scripts/test-*.sh` conventions. The guard's own logic SHALL be covered by a self-test that does not depend on the live repository history.

#### Scenario: Guard runs as part of pre-push verification

- **WHEN** a developer runs `make test-pre-push`
- **THEN** the UI screenshot-sync guard SHALL execute as one of the verification steps

#### Scenario: Guard logic is self-tested

- **WHEN** the self-test runs
- **THEN** it SHALL exercise the failing case, the screenshot-updated passing case, the valid opt-out case, the base-side-opt-out bypass case, and the screenshot-deletion case using temporary git repositories, independent of the project's real commit history
