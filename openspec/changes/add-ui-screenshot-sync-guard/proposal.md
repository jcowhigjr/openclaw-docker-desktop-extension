## Why

This project has no external users yet, so release quality relies on CI gates rather than user reports. UI source can change without anyone refreshing the screenshots in `docs/`, leaving documentation and the marketplace listing silently stale. The `v0.3.6` release shipped a new first-run provider onboarding flow with no screenshot for it — exactly the gap this guard prevents. We want the release path to flag UI-source drift from documented screenshots, while still allowing the common case where a UI change has no visual impact.

## What Changes

- Add a verification script (`scripts/test-ui-screenshot-sync.sh`) that, over a commit range, fails when `ui/` source files changed but no screenshot under `docs/` was updated.
- Default the comparison range to "last release tag..HEAD" so it acts as a release-checklist gate; allow overriding the range via environment variables for PR/CI use.
- Provide an explicit, auditable opt-out for changes with no visual diff (a commit-message trailer such as `Screenshots-Not-Needed:` with a reason), so behavior-only UI fixes are not blocked.
- Wire the script into the `test-pre-push` aggregate target and the Build workflow, following the existing `scripts/test-*.sh` + Makefile conventions.
- Add a self-test (`scripts/test-ui-screenshot-sync-selftest.sh` or equivalent) so the guard's own logic is covered, matching the repo's pattern of dry-run/test scripts.

## Capabilities

### New Capabilities
- `release-quality-gates`: CI/release-checklist guards that enforce documentation freshness against source changes — specifically detecting UI source drift from committed screenshots, with a documented opt-out path.

### Modified Capabilities
<!-- No existing openspec/specs/ directory; no prior spec-level behavior changes. -->

## Impact

- New: `scripts/test-ui-screenshot-sync.sh`, its self-test script, and a Makefile target (`test-ui-screenshot-sync`).
- Modified: `Makefile` (`test-pre-push` chain + `.PHONY`), `.github/workflows/build.yml` (new validate step).
- Developer workflow: UI-only commits that change visuals will need a screenshot update or an explicit opt-out trailer to pass `test-pre-push`.
- No runtime, extension-image, or release-artifact behavior changes; gate is verification-only.
