# Upstream Outreach — ready-to-send drafts

Date: 2026-06-07
Target: `openclaw/openclaw` maintainers (public contact: peter@openclaw.ai)
Companion to: [go-to-market strategy](2026-06-07-go-to-market-strategy.md)

**⚠️ Gate before sending.** Per the strategy, do not post until Phase 0 is done:
trademark search clean, `shellharbor` namespaces claimed, and the Marketplace
listing live (or submission in-flight). The pitch is far stronger as "here's a
working, Marketplace-listed extension" than "here's an idea." These drafts are
ready so the moment the gate clears, you send — no drafting lag.

Send order: **issue first** (step A). Only open the PR (step B) if the issue
gets a warm response.

---

## A. The opening issue (post first)

**Title:**

> Community Docker Desktop extension for OpenClaw — open to a link or endorsement?

**Body:**

> Hi OpenClaw maintainers,
>
> I built and maintain **Shellharbor**, a Docker Desktop extension that runs
> OpenClaw on macOS in one click — `docker extension install`, hit Start, and
> OpenClaw runs in a hardened, localhost-only container managed from the Docker
> Desktop GUI. No terminal, no manual container wiring.
>
> Repo: https://github.com/jcowhigjr/openclaw-docker-desktop-extension
> It's real and in use today — v0.3.6, 9 releases, ~220+ pulls, multi-arch
> images on GHCR + Docker Hub, automated Trivy scanning in the publish workflow.
>
> **Why I'm opening this:** there's no official OpenClaw Docker Desktop path
> today, and this reaches an audience the CLI/brew flow doesn't — GUI users,
> macOS folks who want isolation, and people who don't live in a terminal. It's
> pure additive distribution for OpenClaw.
>
> It is explicitly **community packaging, not official** — I use the OpenClaw
> name only nominatively (the product brand is "Shellharbor"), keep a
> `TRADEMARKS.md` disclaiming affiliation, and built an original icon. If
> anything about that framing isn't to your liking, I'll happily adjust.
>
> **The ask — whatever fits you, no pressure:**
> 1. A link from the README/docs to a "Run via Docker Desktop (community)"
>    option, or
> 2. Acknowledgement as a community extension, or
> 3. A conversation about adopting it into the `openclaw` org / Docker Hub
>    namespace if you'd rather own the Docker path directly.
>
> Happy to open a small README PR, hop on a call, or take any direction you
> prefer. Thanks for OpenClaw — glad to help more people run it.

---

## B. The follow-up README PR (only if the issue is warm)

Keep it the smallest acceptable change — a single link in an existing
"install / run" or "community projects" section. Do not restructure their docs.

**PR title:**

> docs: link community Docker Desktop extension (Shellharbor)

**PR body:**

> Follow-up to #<issue-number>. Adds a one-line pointer to the community Docker
> Desktop extension for running OpenClaw on macOS, as discussed.
>
> - Clearly labeled **community / unofficial**.
> - Links to the repo; no claim of affiliation.
> - Single-line addition, no doc restructuring.
>
> Happy to reword, relocate, or drop entirely per your preference.

**Suggested line to add (adapt to their doc structure):**

> **Run on Docker Desktop (community):** [Shellharbor](https://github.com/jcowhigjr/openclaw-docker-desktop-extension)
> — a community-maintained Docker Desktop extension to run OpenClaw on macOS in
> one click. Not officially affiliated with OpenClaw.

---

## Response playbook

| Reception | Next move |
|---|---|
| Warm / "sure, send a PR" | Post PR (B) immediately; keep it tiny |
| Very warm / "let's make it official" | Discuss adoption into `openclaw` org + Docker Hub namespace; weigh sole-control vs brand+protection |
| Conditional ("rename / change framing") | Comply fast and visibly — goodwill compounds |
| Silent / declined | No loss: you're on record as first + good-faith. Keep running independent under the Shellharbor brand; revisit after more traction |

## Notes
- Tone is value-first and low-pressure on purpose. You're offering free
  distribution, not asking a favor.
- Being **first to ask** while the lane is empty is the whole point — the
  endorsement is the one asset a copycat or an official build can't take.
- Keep the Shellharbor brand front and center so that even an "official OpenClaw
  Docker" later doesn't erase you — you're a named product, not a namespace
  collision.
