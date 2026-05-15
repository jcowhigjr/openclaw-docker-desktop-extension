# Marketplace Smoke Test - 2026-05-15

## Environment

- Repo branch: `exploratory-marketplace-smoke-20260515`
- Base commit under test: `1ba5752` (`Add Docker Hub marketplace publishing (#88)`)
- Extension install under test: `openclaw-docker-extension:dev`
- Runtime image under test: `ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest`
- Docker Desktop extension state: OpenClaw installed and running
- Host Control UI: `http://127.0.0.1:18789`

## Artifacts

- `docker-extension-ls.txt`: Docker Desktop extension registry state
- `docker-ps-a.txt`: container, image, status, and port state
- `openclaw-service.log`: recent OpenClaw runtime service logs
- `control-ui-healthz.txt`: localhost health response
- `control-ui.png`: browser screenshot of the OpenClaw Control UI
- `extension-ui-demo.png`: attempted browser-preview screenshot of the extension UI

## Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Extension registered in Docker Desktop | Pass | `docker-extension-ls.txt` shows `openclaw-docker-extension` with `1 tab(OpenClaw)` and `Running(2)` |
| Runtime container running | Pass | `docker-ps-a.txt` shows `openclaw-docker-extension-service` as healthy |
| Localhost exposure | Pass | `docker-ps-a.txt` shows `127.0.0.1:18789->18790/tcp` |
| Control UI health | Pass | `control-ui-healthz.txt` returns HTTP 200 and `{"ok":true,"status":"live"}` |
| Control UI browser render | Pass with expected auth prompt | `control-ui.png` shows the Gateway Dashboard and auth-required state when opened directly without token bootstrap |
| Extension UI automated screenshot | Fail | `extension-ui-demo.png` is blank in browser preview mode |
| Docker Desktop UI capture | Blocked | Computer Use was blocked on macOS Accessibility/Screen Recording permissions |

## Findings

1. **Fixed before this report: update action hover contrast**
   - PR: #90
   - Status: merged
   - Impact: the update button no longer disappears on hover.

2. **Fixed before this report: Docker SDK inline script rejection**
   - PR: #90
   - Status: merged
   - Impact: token reads, execution-mode reads/writes, and Ollama config writes now use SDK-safe Node eval args.

3. **OpenClaw Control UI direct-open requires auth**
   - Status: expected for direct `http://127.0.0.1:18789` access.
   - Note: the extension path should continue passing the gateway token through the URL fragment when using `Open Control UI`.
   - Follow-up: keep this in manual Docker Desktop UI testing because CLI/browser direct-open does not exercise the token bootstrap button.

4. **Browser demo screenshot path is currently blank**
   - Issue: #93
   - Impact: blocks reliable screenshot refresh for README, GitHub Pages, and Marketplace assets without manual Docker Desktop UI capture.
   - Suggested priority: fix before final Marketplace listing polish.

5. **Skill dependency architecture needs product decision**
   - Issue: #92
   - Example: `openai-whisper` suggests Homebrew even though it is running in the Linux container.
   - Suggested priority: not a blocker for Marketplace submission if clearly documented as deferred, but it should not be presented as a supported Docker Desktop skill flow yet.

## Recommendation

Do not block the `v0.3.4` release solely on this smoke pass. The core extension registration, runtime health, and localhost Control UI health checks pass.

Before Docker Marketplace submission, complete one of these:

- Preferred: fix #93 and refresh the extension UI screenshot through an automated browser-demo path.
- Acceptable fallback: capture the Docker Desktop extension UI manually once Computer Use permissions are available, then use that artifact for #91.

Keep #92 as roadmap/planning unless a Marketplace reviewer or first external tester hits skill install confusion during the review path.
