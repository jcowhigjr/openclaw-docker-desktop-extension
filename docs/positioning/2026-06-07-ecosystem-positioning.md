# OpenClaw Docker Desktop Extension — Ecosystem Positioning

Date: 2026-06-07
Product: `jcowhigjr/openclaw-docker-desktop-extension` (this repo)
Scope: how the extension is positioned and discovered via the OpenClaw GitHub
landing page and the DockerHub / Docker Marketplace path, relative to other
products in the OpenClaw ecosystem.

This document is the positioning source of truth. It feeds the Docker Hub /
GitHub copy (also below) and the discovery action plan (also below). Keep the
short-form listing in [marketplace-listing.md](../marketplace-listing.md)
aligned with the messaging pillars here.

---

## 1. Strategy

### 1.1 The category

The extension is **not a tool in the OpenClaw toolbox**. It is a different
layer.

The other ecosystem products *orbit* OpenClaw — they feed it data, automate it,
or wrap APIs. The extension is **where OpenClaw runs**: the runtime/host layer,
packaged for people who do not live in a terminal.

- Siblings = peripherals around the assistant.
- This product = the managed local runtime for the assistant itself.

That distinction is the whole position. The extension does not compete with the
crawl CLIs or ClawSweeper; it sits on a different shelf entirely.

### 1.2 Where each sibling lives vs the extension

| | Crawl CLIs (slacrawl, notcrawl, gitcrawl…) | gogcli / wacli | crabbox | ClawSweeper | **This extension** |
|---|---|---|---|---|---|
| Job | mirror data → local SQLite | service API in terminal | remote Linux test boxes | automated GitHub triage bot | **run OpenClaw locally** |
| Install | `brew install openclaw/tap/…` | `brew` | `brew` | hosted bot + landing site | **Docker Desktop one-click** |
| Audience | terminal devs | terminal devs | CI / devs | OSS maintainers | **GUI users; macOS isolation seekers** |
| Layer | peripheral | peripheral | test infra | automation | **runtime / host** |
| Discovery surface | Homebrew tap | tap | tap | landing page (clawsweeper.bot) | **Docker Marketplace + DockerHub** |

### 1.3 Three strategic facts

1. **The DockerHub `openclaw` namespace is empty.** No OpenClaw images are
   published by anyone in the ecosystem. The extension is the first and only
   OpenClaw thing reachable via the Docker surface. "OpenClaw on Docker Desktop"
   is uncontested — own that search.
2. **The extension ships under `jcowhigjr/`, not `openclaw/`.** It is not on the
   OpenClaw org landing page (73 repos, star-ranked, 6 pinned) and inherits
   **zero** discovery from the 377k★ brand. This is the single biggest fixable
   gap.
3. **Different shelf, no rivalry.** `brew install` reaches terminal devs. Docker
   Desktop reaches GUI/ops people who want isolation and one-click lifecycle. No
   sibling competes on that shelf, so the play is occupy, not outcompete.

### 1.4 Positioning statement

> For Mac users who want to run OpenClaw without touching the terminal, the
> **OpenClaw Docker Desktop Extension** is a one-click Docker Desktop app that
> starts, isolates, and manages OpenClaw on localhost. Unlike the
> brew-installed OpenClaw CLIs and crawl tools, it needs no command line and
> runs OpenClaw in a hardened, localhost-only container you control from a GUI.

### 1.5 Messaging pillars

1. **One-click run, no terminal.** Every sibling is a `brew`/CLI flow. This is
   the GUI on-ramp to OpenClaw.
2. **Isolated & localhost-only.** Read-only root FS, `--cap-drop=ALL`,
   `no-new-privileges`, `127.0.0.1`-only bind. A safety story no sibling tells.
3. **Managed lifecycle.** Start/stop/restart/update from a GUI, runtime update
   checks, persistent named volume, host-Ollama offline path, execution-mode
   control.
4. **Honest third-party.** "Community packaging, not official." Trust through
   transparency — the README and `TRADEMARKS.md` already set this tone.

### 1.6 The one hard constraint

The extension **cannot claim to be official** (README states it; `TRADEMARKS.md`
exists). Positioning therefore leans on "community extension." Fact 1.3.2 (wrong
namespace) is converted not by claiming the brand but by *earning a link* from
it — see the action plan, section 3.

### 1.7 What NOT to say

- Do not imply it is an official Docker or OpenClaw product.
- Do not position against the crawl tools as a competitor — wrong shelf, dilutes
  the layer story.
- Do not lead with "trial path" framing alone; "trial" undersells the managed
  runtime value. Lead with one-click run + isolation, mention trial as the
  on-ramp.
- Do not overclaim the security boundary — "more isolated," not "sandboxed."

---

## 2. Copy

Drop-in copy for each surface. Tuned to the pillars above. Keep the existing
[marketplace-listing.md](../marketplace-listing.md) fields in sync with these.

### 2.1 DockerHub repository — short description (≤100 chars)

> Run OpenClaw on your Mac in one click — isolated, localhost-only, managed from Docker Desktop.

### 2.2 DockerHub repository — overview

> **The one-click way to run OpenClaw on macOS.**
>
> OpenClaw is your personal, open-source AI assistant. This Docker Desktop
> extension is the GUI on-ramp: install it, click **Start**, and OpenClaw runs
> in a hardened, localhost-only container you manage entirely from Docker
> Desktop — no terminal, no manual container wiring.
>
> - **One-click run** — start, stop, restart, and open the Control UI from a GUI.
> - **Isolated by default** — read-only root filesystem, all Linux capabilities
>   dropped, `no-new-privileges`, bound to `127.0.0.1` only.
> - **Managed lifecycle** — persistent state in a named volume, runtime update
>   checks, and one-click updates that preserve your settings.
> - **Offline-capable** — guided host-Ollama setup for local models after the
>   model is downloaded.
>
> Community packaging, not an official Docker or OpenClaw product. It is a more
> isolated, easier-to-clean-up local path than a direct host install — not a
> perfect security boundary.

### 2.3 GitHub repository — description (the one-line "About" field)

> One-click Docker Desktop extension to run OpenClaw on macOS — isolated, localhost-only, GUI-managed. Community packaging.

### 2.4 GitHub README — hero block (replaces the top of README.md)

> # Shellharbor — Run OpenClaw on your Mac in one click
>
> **Run OpenClaw on your Mac in one click.** A Docker Desktop extension that
> starts, isolates, and manages [OpenClaw](https://github.com/openclaw/openclaw)
> — your personal, open-source AI assistant — in a hardened, localhost-only
> container. No terminal required.
>
> *Community packaging. Not an official Docker or OpenClaw extension.*
>
> [Install](#) · [How it works](#what-this-project-is) · [Security notes](#security-and-isolation-notes)

### 2.5 GitHub topics (improve repo search surfacing)

`openclaw` · `docker-desktop-extension` · `docker-extension` · `ai-assistant` ·
`macos` · `ollama` · `localhost` · `self-hosted` · `llm`

### 2.6 One-liner variants (for the landing page hero / social / submission)

- Short: **Run OpenClaw on your Mac in one click.**
- With value: **OpenClaw, one-click and isolated — straight from Docker Desktop.**
- Audience-first: **The OpenClaw on-ramp for people who don't live in a terminal.**

---

## 3. Discovery action plan

Ordered by leverage. Each item: what, why, surface.

### Tier 1 — convert the inherited-discovery gap (highest leverage)

1. **Get linked from upstream OpenClaw.** Open a PR / issue on
   `openclaw/openclaw` proposing a "Community packaging / Run via Docker
   Desktop" link in the upstream README or docs. This is the single highest-ROI
   move: it converts fact 1.3.2 without claiming the brand. *Surface: GitHub
   landing + upstream README.*
2. **Ask to be listed in `openclaw/homebrew-tap`'s neighborhood / org README.**
   Even a one-line "Docker Desktop extension: …" pointer on an org-visible
   surface inherits trust. *Surface: GitHub org landing.*
3. **Seed the DockerHub `openclaw` story.** The `openclaw` DockerHub namespace
   is empty. Either (a) request the org publish/redirect to your image, or (b)
   ensure your `jcowhigjr/openclaw-docker-desktop-extension` Docker Hub repo has
   a full description, logo, and the overview from 2.2 so it ranks for "openclaw"
   search. *Surface: DockerHub.*

### Tier 2 — own the uncontested Docker surface

4. **Complete Docker Marketplace submission.** Greatest non-`v` semver tag must
   be public (see README). Marketplace listing = the canonical, discoverable
   one-click path and the strongest "first OpenClaw on Docker Desktop" claim.
   *Surface: Docker Marketplace.* Track against
   [submission-readiness.md](../submission-readiness.md).
5. **Polish the Docker Hub repo page** with copy from section 2.1–2.2, the
   `icon.svg` logo, and screenshots. Pull-count and a complete page both
   feed Docker search ranking. *Surface: DockerHub.*

### Tier 3 — cross-link the ecosystem

6. **Cross-link tap ↔ extension.** Landing page and README should point to the
   sibling distribution paths (Homebrew tap) and frame the extension as the GUI
   layer, so ecosystem visitors self-select onto the right shelf. *Surface:
   landing page + README.*
7. **Tighten GitHub repo metadata** — apply the description (2.3), topics (2.5),
   and hero (2.4). Topics are a real GitHub discovery surface for a repo that
   will never be pinned on the org. *Surface: GitHub repo.*
8. **Refresh the landing page hero** to lead with the one-liner (2.6) and the
   pillars, not the install mechanics. *Surface: landing page.*

### Sequencing

Tier 1 first — discovery leverage dwarfs copy polish. Item 1 (upstream link) and
item 4 (Marketplace) are the two that change the trajectory; everything else is
supporting. Items 5–8 can run in parallel any time.
