## 1. Guard script

- [x] 1.1 Create `scripts/test-ui-screenshot-sync.sh` (executable) that resolves a commit range: honor env override (`DIFF_RANGE` or `BASE_REF`/`HEAD_REF`), else default to `<last v* tag>..HEAD` via `git describe --tags --abbrev=0 --match 'v*'`.
- [x] 1.2 Implement safe fallback: if no `v*` tag exists, print a notice and exit 0.
- [x] 1.3 Detect visual-relevant changes: `git diff --name-only <range>` filtered to paths under `ui/src/`.
- [x] 1.4 Detect screenshot updates: changed paths under `docs/` matching `*.png|*.jpg|*.jpeg|*.gif|*.webp`.
- [x] 1.5 Implement opt-out: scan `git log <range>` for a `Screenshots-Not-Needed:` trailer with a non-empty reason; treat empty/whitespace reason as invalid.
- [x] 1.6 Decision logic + exit codes: pass when no ui/src changes, or screenshot updated, or valid opt-out; fail otherwise. On failure, list offending `ui/src/` files and explain the opt-out trailer.

## 2. Self-test

- [x] 2.1 Create `scripts/test-ui-screenshot-sync-selftest.sh` that builds throwaway repos in `mktemp -d` and invokes the guard with explicit ranges.
- [x] 2.2 Cover cases: (a) ui change, no screenshot → expect fail; (b) ui change + screenshot → expect pass; (c) ui change + valid opt-out trailer → expect pass; (d) ui change + empty-reason trailer → expect fail; (e) no ui change → expect pass; (f) no release tag → expect pass.
- [x] 2.3 Ensure self-test cleans up temp dirs and returns non-zero if any case's actual exit code differs from expected.

## 3. Wiring

- [x] 3.1 Add Makefile target `test-ui-screenshot-sync` invoking the self-test (deterministic, history-independent) for `test-pre-push`.
- [x] 3.2 Append `test-ui-screenshot-sync` to the `test-pre-push` chain and to `.PHONY`.
- [x] 3.3 Add a `build.yml` validate step that runs the self-test; on `pull_request`, also run the guard with an explicit range (`origin/${{ github.base_ref }}...HEAD`) and ensure tags/history are fetched (`fetch-depth: 0` or fetch tags).

## 4. Documentation

- [x] 4.1 Document the `Screenshots-Not-Needed:` opt-out trailer and the guard's behavior in AGENTS.md (or CONTRIBUTING) — including the squash-merge caveat.

## 5. Demo onboarding capture flag

- [x] 5.1 Add a demo sub-flag (e.g. `?demo=1&onboarding=fork`) parsed in `ui/src/dockerDesktopDemoClient.ts` / `App.tsx` that forces first-run state (unset provider, empty ollama models) so the `fork` onboarding phase renders in demo mode.
- [x] 5.2 Support the other phases (`free-needs-model`, `free-ready`) via the same flag values so each new onboarding screen is screenshot-reachable.
- [x] 5.3 Add a unit test asserting the flag maps to the expected `deriveOnboardingPhase` inputs.
- [x] 5.4 Capture the new first-run fork-card screenshot via `capture-readme-screenshot.sh` (SCREENSHOT_URL with the flag) and commit it under `docs/`.

## 6. Verification

- [x] 6.1 Run `make test-ui-screenshot-sync` and confirm pass.
- [x] 6.2 Run full `make test-pre-push` and confirm the new step runs and the suite stays green.
- [x] 6.3 Manually confirm a simulated `ui/src/` change with no screenshot fails the guard, and the same change with the opt-out trailer passes.
- [x] 6.4 Confirm `?demo=1&onboarding=fork` renders the fork card and the capture script produces a valid screenshot.
