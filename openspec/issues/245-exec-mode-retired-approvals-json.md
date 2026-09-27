**Delivery order:** 2 of 3 in the v0.5.x first-chat batch (blocked by: none; land after #242 because it reuses the same "call the upstream CLI instead of writing its files" pattern)
**Minimum agent tier:** T2 — one helper read/write pair and its UI parser move to a documented upstream CLI; the replacement is proven below; no design question left open

## Problem

The execution-mode control (`Safer` / `Full access`) is wrong in both directions on `v0.5.0`, which ships OpenClaw `2026.9.3`:

1. **Fresh install shows the wrong mode.** Nothing writes an exec policy on first start. `detectExecutionMode` in `ui/src/execMode.ts` returns `safer` whenever the fields are missing, so the extension shows *"Safer mode is currently applied"*. OpenClaw's own default for a gateway host is `security=full`, `ask=off`. The user is told they are in Safer mode while every command runs without approval.
2. **Clicking Safer (or Full) writes a file the runtime has retired.** `exec-mode-write` in `runtime/openclaw-extension-helper.js` writes `~/.openclaw/exec-approvals.json`. In `2026.9.3`, approvals live in SQLite (`~/.openclaw/state/openclaw.sqlite#exec_approvals_config`), and the JSON file is legacy input that needs `openclaw doctor --fix`. After the write, OpenClaw refuses to evaluate exec policy at all.
3. The helper also writes `tools.exec.security` / `tools.exec.ask`. `2026.9.3` writes `tools.exec.mode` for the same intent.

This is the same failure class as #242: the extension writes a storage format that its own bundled OpenClaw has moved away from. CI cannot see it because the tests only assert that the JSON was written.

This matters for submission. `docs/submission-readiness.md` lists "explicit execution-mode controls for safer vs full-access command execution" as a ready feature.

## Evidence (2026-09-24, runtime `0.5.0`, OpenClaw `2026.9.3 (1391f7c)`)

Live install, never toggled. The extension UI says "Safer mode is currently applied", but OpenClaw reports:

```
$ openclaw exec-policy show --json
approvalsExists=false  security=full ask=off askFallback=deny  (OpenClaw default (full))
```

Disposable volume restored from the same install's snapshot:

| Step | Result |
|---|---|
| `node openclaw-extension-helper.js exec-mode-write safer` | rc=0, writes `/home/node/.openclaw/exec-approvals.json` |
| `openclaw exec-policy show --json` | rc=1: `Legacy exec approvals exist at /home/node/.openclaw/exec-approvals.json. Run openclaw doctor --fix before using exec approvals.` |
| Remove legacy file and `tools.exec`, then `openclaw exec-policy preset cautious --json` | rc=0 → `security=allowlist ask=on-miss askFallback=deny`, config `tools.exec={"host":"gateway","mode":"ask"}` |
| `openclaw exec-policy preset yolo --json` | rc=0 → `security=full ask=off askFallback=full` |
| `preset cautious` again | rc=0 → back to allowlist / on-miss / deny; no `exec-approvals.json` is created |
| `preset yolo` run with `docker exec` **while the gateway is running** | rc=0; `exec-policy show` reflects it (no SQLite contention, unlike `doctor --fix`) |

Upstream docs, from `/app/docs/tools/exec-approvals.md` in the image:
- `cautious` = `host=gateway, security=allowlist, ask=on-miss, askFallback=deny`. That is exactly the extension's Safer.
- `yolo` = `security=full, ask=off, askFallback=full`. That is exactly Full access.
- An unconfigured gateway host defaults to `full` / `off`.

Not yet verified: whether the legacy file also makes the `exec` *tool* fail at runtime, beyond the policy CLI. Treat that as likely, but confirm it during implementation with one agent turn.

## Proposed fix

1. `exec-mode-write <safer|full>` runs `openclaw exec-policy preset cautious|yolo --json` and stops writing `exec-approvals.json` and `tools.exec.security/ask` directly.
2. `exec-mode-read` returns the effective policy from `openclaw exec-policy show --json`. The UI maps `effective security=full && ask=off` to Full access and anything stricter to Safer. When nothing is configured, the UI must show Full access (OpenClaw's default), not Safer.
3. Existing installs with a helper-written `exec-approvals.json`: the next Apply removes the legacy file before calling the preset, since the preset rewrites the whole policy anyway. Alternatively, show a one-line remedy naming `openclaw doctor --fix` (which must run with the service stopped; see #242).
4. Out of scope, but flag it in the PR: whether a fresh install should *default* to Safer is a product decision. This issue only makes the displayed mode match what OpenClaw enforces.

## Acceptance criteria

- [ ] On a fresh `2026.9.3` volume, the extension shows Full access, and `openclaw exec-policy show` agrees.
- [ ] Applying Safer gives effective `allowlist / on-miss / deny`; applying Full gives `full / off / full`. Both are read back through `exec-policy show`, not by re-reading files.
- [ ] After either Apply, no `~/.openclaw/exec-approvals.json` exists, and `openclaw exec-policy show` exits 0.
- [ ] A volume carrying a helper-written legacy `exec-approvals.json` recovers on the next Apply without a terminal.
- [ ] Tests assert the helper invokes the preset command and that the UI parses `exec-policy show --json` output (use a fixture captured from `2026.9.3`). Do not only assert that files get written.
- [ ] One exec tool call succeeds after applying each mode (Full: runs; Safer: prompts or is allowlist-gated as documented).

Related: #242 (same storage-migration class), #241 (clean-install first chat), #215 (upgrade/recovery).
