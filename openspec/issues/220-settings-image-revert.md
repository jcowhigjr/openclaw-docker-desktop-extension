**Delivery order:** 1 of 1 (independent; #215's downgrade banner is a separate defect that must also be fixed for the hazard to close)
**Minimum agent tier:** T2

## Original report

**Delivery order:** 1 of 1 (independent; re-arms the #215 downgrade trap every time it happens)
**Minimum agent tier:** T2

## Problem

The `OpenClaw Image` setting appears not to survive a restart. After being set to a local
tag and saved, it later reads the default GHCR tag again — while the *running container*
is still on the local tag. The two disagree, and the stale value re-arms the
"Update and Restart" banner that removes a working container (#215).

## Observed sequence

1. Field set to `openclaw-docker-extension-runtime:dev`, **Save Settings** clicked
   (screenshot confirms the value was in the field).
2. Machine restarted.
3. Field now reads `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.6`.
4. Banner returned: *"A new runtime image version is available for
   ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.6"*.
5. `docker inspect` shows the container still on `openclaw-docker-extension-runtime:dev`
   running OpenClaw 2026.9.1 — so only the *setting* reverted, not the container.

## Uncertainty — please confirm before treating as proven

I did not witness the Save round-trip complete. Between steps 1 and 3 the user also
triggered a container removal, so there are three candidate explanations and this issue
does not pick between them:

- **A.** `Save Settings` never persisted the value.
- **B.** It persisted, and restart/removal reset it to the default.
- **C.** It persisted, but the settings *display* falls back to the default rather than
  reading the stored value.

Reproduce cleanly first: set the field, save, confirm where it is stored, restart Docker
Desktop only (no container removal), and re-read. That distinguishes A/B/C.

## Why it matters

Whatever the cause, the effect is that the extension advertises an update to an image
that is **older** than what is running. Acting on that banner destroys a working install
(#215, confirmed in the wild). A stale or non-persisting setting turns a one-time hazard
into a recurring one.

## Acceptance criteria

- [ ] Root cause identified among A/B/C above
- [ ] `OpenClaw Image` survives a Docker Desktop restart and a host reboot
- [ ] The update banner compares against the **configured** image, and never offers an
      image whose OpenClaw version is older than the running one
- [ ] If the configured image and the running container disagree, the UI says so plainly
      rather than silently offering to "update"


## Root cause (confirmed)

## Root cause confirmed — and it is none of the three candidates above

The original report listed three possibilities: (A) Save never persisted, (B) it persisted
and something reset it, (C) it persisted but the display falls back to the default.

The real answer is a fourth: **the value persists correctly and is discarded every time it
is read back.**

### Evidence

The write path is clean. `persistConfig` stores exactly what it is given:

```js
// ui/src/App.tsx:201
const persistConfig = useCallback((next: ExtensionConfig) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setConfig(next);
}, []);
```

The read path throws it away. `loadConfig` rewrites three stored values back to the
build-time default:

```js
// ui/src/App.tsx:129-138
if (stored === 'ghcr.io/openclaw/openclaw:latest') {
  return DEFAULT_CONFIG.image;
}
if (
  stored === 'openclaw-docker-extension-runtime:dev' ||
  stored === 'ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest'
) {
  return DEFAULT_CONFIG.image;
}
return stored;
```

So `openclaw-docker-extension-runtime:dev` **can never be persisted as a setting**. Saving
it works, the write succeeds, and the next mount silently replaces it. Nothing is wiped and
nothing about Docker Desktop's storage is at fault.

Note this is not a one-time migration: there is no schema version, no migrated-flag, no
guard. It runs on **every** load. Saving the value a hundred times gives the same result.

### Why this value in particular is the wrong one to rewrite

`openclaw-docker-extension-runtime:dev` is not a stale artifact — it is **this repo's own
canonical local build tag**:

```
Dockerfile:2   ARG VITE_DEFAULT_RUNTIME_IMAGE=openclaw-docker-extension-runtime:dev
Makefile:3-4   RUNTIME_IMAGE ?= openclaw-docker-extension-runtime
               RUNTIME_TAG   ?= dev
```

It is what `make install-dev` produces. The rewrite therefore discards precisely the tag a
maintainer would pin when running a locally built runtime — which is the recovery case.

The asymmetry makes it worse: on a build whose `DEFAULT_RUNTIME_IMAGE` is already
`...:dev`, the rewrite is a no-op. On a **release** build, where the default is the GHCR
ref, it is destructive. It only misfires in the situation where it does damage.

### How this produced the observed failure

1. Field set to `openclaw-docker-extension-runtime:dev`, saved — write succeeded.
2. On the next mount `loadConfig` returned the GHCR default instead.
3. Settings then read `ghcr.io/...runtime:0.3.6` while the container still ran `:dev`.
4. `checkForUpdate` compares the configured image SHA against the running container SHA
   with no notion of direction, so "different" became "update available" — for an image
   three months older than what was running.
5. Acting on that banner destroyed the install (#215).

Steps 4-5 are a separate defect in `checkForUpdate` (App.tsx:874) and are not fixed by
fixing this issue. Both need to land for the hazard to close.

### Fix

Narrow the rewrite to genuinely obsolete refs and stop clobbering intentional local tags.
`ghcr.io/openclaw/openclaw:latest` (upstream image, not the runtime wrapper) and
`ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest` (former repo name) are
defensible migrations. `openclaw-docker-extension-runtime:dev` is not — it is a valid,
documented, intentional choice.

Suggested acceptance criteria, replacing the originals:

- [ ] A stored `openclaw-docker-extension-runtime:dev` survives reload, Docker Desktop
      restart, and host reboot
- [ ] Any locally-scoped image ref (no registry host) is preserved rather than rewritten
- [ ] The two genuinely obsolete GHCR refs still migrate, and say so in the UI rather than
      changing silently
- [ ] Running image is displayed read-only next to Configured image, so a divergence is
      visible instead of inferred
- [ ] A regression test asserts a round trip of a local tag through save -> load

### Correction to the original report

The report said "I did not witness the Save round-trip complete" and asked for a clean
reproduction to distinguish A/B/C. That reproduction is no longer needed — the code path is
unambiguous. The suggestion elsewhere of adding fallback storage in case Desktop wipes
localStorage should be **dropped unless independently evidenced**: no wipe is occurring,
and building durability for a failure that is not happening would leave the real cause in
place.

