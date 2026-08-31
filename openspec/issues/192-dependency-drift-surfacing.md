# Issue #192: Surface external dependency drift and stopped engines

Tracking: <https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/192>

## Problem

Both external dependencies change and stop underneath the user, silently, and
the extension neither detects nor explains it.

**They auto-update unattended.** Ollama runs an updater on a 1-hour interval
(`beginning update checker interval=1h0m0s`) and rewrites `/Applications/Ollama.app`
in place: observed 0.33.0 -> downloaded 0.33.1 -> upgraded -> 0.33.2 across five
days, with no user action. On this host `/opt/homebrew/bin/ollama` is a
**symlink into the app bundle**, so the CLI's version changes too, without
Homebrew involvement — one binary, two entry points, one invisible updater.
Docker Desktop has `AutoDownloadUpdates = True`.

That update sequence correlates exactly with the inference engine breaking
(see the preflight issue): 0 -> 6 -> 112 load failures across log rotations.

**Neither starts itself.**
- Ollama: `service is currently disabled and will not start at login`
- Docker Desktop: `AutoStart = False`, and its registration actually failed:
  `AutoStartError = option disabled because operation is not permitted when
  registering app service`

So the user's real startup chain is: launch Ollama manually, launch Docker
Desktop manually, open the extension (container does auto-start — this part
works), then click through to a browser tab. `docker-compose.yaml` also sets
`restart: "no"`, so the container does not survive a Docker restart.

## Why this matters beyond one machine

Every user is exposed to the same thing: an inference engine that updates itself
weekly, a container engine that stages updates but cannot auto-start, and a
four-surface launch sequence. The failure mode is always the same — something
worked yesterday and silently doesn't today, and the extension says nothing.

## Proposed change

A dependency preflight card, shown before the provider flow:

1. **Docker engine reachable?** If not, say so plainly and link to starting it.
   Today the extension simply cannot load.
2. **Ollama reachable AND able to load?** (covered by the preflight probe issue)
3. **Record the observed Ollama version** on successful setup; on a later run,
   if the version changed and the load probe now fails, say so directly:
   "Ollama updated from X to Y since your last working session, and can no
   longer load models."

That third point is the cheap, high-value one: it converts a mystifying
regression into a one-line explanation.

## Acceptance criteria

- [ ] Engine-unreachable renders an explicit actionable message, not a blank or
      spinning panel.
- [ ] Last-known-good Ollama version persisted with the extension config.
- [ ] When the version changed since last success and the probe fails, the UI
      names both versions.
- [ ] Version-drift banner never appears when the probe passes.
- [ ] Unit tests for the drift comparison (no drift / drift+pass / drift+fail).

## Out of scope

- Pinning, managing, or disabling anyone's updates.
- Auto-starting Docker or Ollama on the user's behalf.
- Re-litigating the delivery model. Tracked separately if traction warrants.
