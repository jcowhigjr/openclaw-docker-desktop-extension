# CLAUDE.md

This file exists so Claude Code loads the repo contract without depending on any
user's global configuration.

**Read [AGENTS.md](AGENTS.md). It is the single source of truth for this repo.**
Do not duplicate guidance here — add it to `AGENTS.md` instead.

Points most often missed, repeated here only as pointers:

- Issue Delivery Contract — every issue needs a delivery order and a minimum agent tier.
- Agent Contract Interoperability — never set repo-local git identity; never branch from local `main`.
- Public Repository Boundary — check before adding anything user-specific.
