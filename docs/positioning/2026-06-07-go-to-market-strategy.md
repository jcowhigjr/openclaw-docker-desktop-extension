# Shellharbor — Go-to-Market & Moat Strategy

Date: 2026-06-07
Product: `jcowhigjr/openclaw-docker-desktop-extension`, branded **Shellharbor**
Companion to: [ecosystem positioning](2026-06-07-ecosystem-positioning.md)

The thesis in one line: **the OpenClaw-on-Docker lane is empty; first-mover is
not a moat until upstream blesses it.** This doc is the sequence to convert the
empty lane into a durable position before a copycat or an official build fills
it.

---

## 1. Strategy mindmap

```
                          SHELLHARBOR MOAT
                                 |
        +------------------------+------------------------+----------------------+
        |                        |                        |                      |
   DEFENSIBLE ASSET         DISTRIBUTION /            UPSTREAM                DEFENSE /
   (what's ownable)         DISCOVERY                 RELATIONSHIP            MONITORING
        |                        |                        |                      |
  - Brand: Shellharbor      - Docker Marketplace     - No official exists    - Watch for copycats
    (npm/GH/DH/PyPI free)     listing (uncontested)    = open lane           - Watch upstream for
  - Own icon (copyright)    - DockerHub repo page     - Leverage: you bring    an official Docker build
  - TRADEMARKS.md asserts     (SEO, logo, desc)         GUI/Mac users they   - Keep release velocity
    the mark                - GitHub topics/About       don't reach            (already v0.3.6)
  - "OpenClaw" nominative   - Landing page          - Ask: link / endorse / - Brand = survival layer
    only (not the brand)    - 222 pulls, growing       adopt                   if upstream goes official
        |                        |                        |                      |
   LEGAL GATE              FIRST-MOVER WINDOW        THE PIVOTAL MOVE        HEDGE
   (must clear first)      (use it now)             (do from strength)      (Shellharbor ≠ collision)

  Central insight: the SAME move (get blessed by upstream) defeats BOTH threats —
  a copycat AND an official upstream build. Everything else is supporting work.
```

### The two threats, one defense

| Threat | Why it hurts | Defeated by |
|---|---|---|
| Upstream ships an official Docker extension | Official badge + `openclaw` namespace + 377k★ pin buries you | Being the one they link/endorse/adopt *first* |
| A copycat clones the thin wrapper | Idea is unpatentable, easy to copy | Same — endorsement + install base they can't clone |

---

## 2. Order of communications

Sequence matters: **arrive to upstream from strength** (assets locked, product
live), pitch value-first, escalate commitment only as reception warms.

### Phase 0 — Silent prep (no outreach yet)
Lock what makes you credible before anyone is contacted. None of this is public-facing comms.

1. **Legal gate** — trademark search on "Shellharbor" (incl. CNCF "Harbor" in container space). Cheap to start; do before spending on a domain or announcing the name widely.
2. **Claim the namespaces** — GitHub org `shellharbor`, Docker Hub org `shellharbor`. Free, instant, stops a squatter.
3. **Grab the domain** — `shellharbor.ai` / `.bot` (ecosystem uses both).
4. **Finish the Marketplace submission** — greatest non-`v` semver already public; get listed so you arrive as a live, in-Marketplace product, not a hobby repo.

> Gate: do not start Phase 1 until the legal search comes back clean and you are listed (or submission is in-flight). The pitch is far stronger as "here's a working, Marketplace-listed extension" than "here's an idea."

### Phase 1 — Upstream, low-commitment first (the pivotal comm)
Target: `openclaw/openclaw` maintainers (peter@openclaw.ai is the public contact).

5. **Open a GitHub issue first, not a PR.** Public, low-pressure, gauges reception. Content:
   - You built a Docker Desktop extension for OpenClaw (link, pull count, version).
   - There is no official Docker path today; you fill a gap for GUI / macOS / non-terminal users they don't currently reach.
   - Ask the open question: would they like to **link it** from the README, **endorse** it as a community extension, or discuss **adoption**?
   - Tone: value-first, good-faith, not entitled. You're offering free distribution, not asking a favor.
6. **Read the response, then escalate to the matching commitment:**
   - Warm → offer a **PR** adding a "Run via Docker Desktop (community)" link to the upstream README. Smallest, most acceptable ask.
   - Very warm → discuss donating/adopting into the `openclaw` org + DockerHub namespace (you trade sole control for brand + protection).
   - Cool / no response → you are now on record as good-faith and first. Keep running independent; revisit later. No loss.

### Phase 2 — Docker (secondary)
7. Once Marketplace-listed, engage Docker's extension community / verified-publisher track if one is available — adds a second trust badge independent of upstream.

### Phase 3 — Ongoing
8. Monitor: searches for new OpenClaw Docker wrappers (copycats) and any upstream move toward an official extension.
9. Keep release velocity (you're at v0.3.6 / 9 releases) — being the actively-maintained one is part of the moat.

---

## 3. Master checklist

Status legend: [x] done · [ ] to do · [~] in progress / partial

### Brand & legal (mostly done)
- [x] Pick an ownable, available brand — **Shellharbor** (npm/GitHub/DockerHub/PyPI all free)
- [x] Original icon, asserted as own copyright
- [x] `TRADEMARKS.md` asserts Shellharbor as the project's mark
- [x] `TRADEMARKS.md` corrects OpenClaw basis to nominative fair use
- [x] Wire brand through repo (icon, titles, README, landing, listing, tests)
- [ ] **Legal gate:** formal trademark search on "Shellharbor" (incl. CNCF "Harbor")
- [ ] Liability / ToS review for the agent-runs-commands `Full access` mode (esp. if monetized later)

### Defensible assets (Phase 0)
- [ ] Claim GitHub org `shellharbor`
- [ ] Claim Docker Hub org `shellharbor`
- [ ] Register domain `shellharbor.ai` / `.bot`
- [ ] Confirm Marketplace title validator accepts multiword `Shellharbor for OpenClaw`
- [ ] Complete Docker Marketplace submission

### Discovery / distribution (in progress)
- [x] Value-led copy on README, landing page, marketplace listing
- [x] GitHub repo description + 8 discovery topics
- [ ] Docker Hub repo page: paste short description, add logo + screenshot
- [ ] Drive pulls + stars (the compounding install-base moat)

### Upstream relationship (the moat — not started)
- [ ] **Open the upstream issue** (Phase 1, step 5) — the single highest-leverage action
- [ ] Follow up with README-link PR if reception is warm
- [ ] Decide adopt-vs-independent if upstream offers adoption

### Defense / monitoring
- [ ] Set a recurring check for new OpenClaw Docker wrappers + upstream official-extension signals
- [ ] Maintain release cadence

---

## 4. The one-sentence plan

Lock the brand + assets quietly (Phase 0), get listed on an empty Marketplace
lane, then **ask upstream for the link while you're the only one in the lane** —
because the endorsement is the only thing a copycat or an official build can't
take from you.
