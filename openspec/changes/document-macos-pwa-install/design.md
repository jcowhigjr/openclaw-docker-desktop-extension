## Context

The extension already documents the core local-build flow, the GHCR release-image path, and the current roadmap gates. The original request was framed as a documentation task for installing the OpenClaw UI as a standalone Chrome app on macOS.

Manual validation changed the architecture assessment. The base extension path serves the Control UI from the local gateway on `127.0.0.1`, while the extension UI separately reads the gateway token and asks the user to copy it manually. When Portless was used to create an installable alternate hostname, three separate concerns appeared immediately:

- non-loopback origin allowlisting via `gateway.controlUi.allowedOrigins`
- self-signed certificate trust and browser interstitials
- auth bootstrap failure because the second-origin app no longer shares the intended local dashboard launch semantics

Subsequent manual validation also confirmed that the Control UI can already run as an installed browser app on macOS from the canonical localhost path without Portless. That is important because it narrows the remaining gap: installed-app behavior itself is not blocked; the missing piece is a first-class extension launch/bootstrap flow that aligns with the upstream local dashboard model.

That means the problem is not "write better Portless docs." The problem is that the extension has a localhost-only launch model, but no first-class installed-app/bootstrap model. This repo is intentionally scoped and the roadmap marks polish work like this as `Post-Traction`, so the correct design is to strengthen the canonical local Control UI flow rather than adopt Portless as product architecture.

## Goals / Non-Goals

**Goals:**
- Preserve one canonical Control UI origin for the extension-managed OpenClaw service.
- Replace the current raw URL plus manual token-copy launch flow with a browser bootstrap flow that matches upstream dashboard semantics.
- Make the canonical local Control UI path viable for installed-app treatment on macOS.
- Keep the main README quick start focused on the base install path while making the improved local app flow discoverable.
- Keep roadmap language honest by placing this work in the `Post-Traction` bucket.

**Non-Goals:**
- Building native packaging for macOS outside browser-installed app support.
- Making Portless, reverse proxies, or alternate hostnames part of the base extension install path.
- Broadening the runtime into a general-purpose reverse-proxy hosting solution.
- Solving offline-first sync, CRDT storage, or wider local-first persistence questions in this change.

## Decisions

1. Keep the canonical Control UI origin on localhost and do not adopt Portless as the default app-hosting path.
Rationale: upstream OpenClaw expects the Control UI to be served by the gateway and to speak directly to the gateway WebSocket on the same origin. Portless adds proxy/origin/cert complexity that is not inherent to a same-machine app and immediately exposed missing product semantics, while localhost-installed browser-app behavior has already been manually proven to work.
Alternative considered: formalizing the Portless host as the installed-app URL. Rejected because it turns an optional proxy into a core hosting dependency and forces the product to own alternate-origin hardening before it owns first-class local app launch.

2. Reproduce the upstream dashboard bootstrap model instead of exposing a raw URL and a separate copy-only token field.
Rationale: upstream docs describe the Control UI as a gateway-served app whose auth is supplied during the WebSocket handshake and whose dashboard bootstrap flow manages tokenized versus non-tokenized URLs intentionally. The extension should align with that contract instead of asking the user to assemble the connection manually.
Alternative considered: keeping the current copy-token UX and only improving the docs. Rejected because the current UX is acceptable for troubleshooting but not for an installed local app experience.

3. Promote gateway web-surface settings into explicit extension-owned runtime configuration when needed.
Rationale: the extension currently stores its own UI settings in browser local storage but real gateway behavior lives in `/home/node/.openclaw/openclaw.json` inside the container. A correct installed-app architecture needs first-class ownership of launch/bootstrap and, if ever needed later, web-surface settings such as `controlUi.allowedOrigins`.
Alternative considered: continuing to mutate runtime config ad hoc only for specific experiments. Rejected because that keeps the architecture fragmented and makes deliberate web-surface behavior hard to support safely.

4. Keep documentation secondary to a working canonical launch path.
Rationale: docs should describe a supported architecture, not memorialize a broken proxy exploration. Once the local launch/bootstrap flow is correct, docs can explain how to install that path as a standalone browser app on macOS.
Alternative considered: preserving the current docs-first Portless proposal and adding caveats. Rejected because it would encode an exploration artifact as the recommended direction.

## Risks / Trade-offs

- [Upstream dashboard bootstrap semantics may not map directly onto the extension host.openExternal flow] -> Validate the exact URL/token/session behavior before changing the extension launch button or docs.
- [The extension currently treats launch config and gateway config as separate worlds] -> Keep the first implementation narrow and only promote the minimal runtime settings needed for a correct local app flow.
- [Installed-app behavior differs across Chrome versions] -> Document install guidance only after the canonical localhost launch flow is verified and stable.
- [Portless exploration may tempt further proxy-specific fixes] -> Explicitly classify Portless findings as validation evidence, not as the product target architecture.

## Migration Plan

1. Reframe the issue and proposal around canonical localhost launch/bootstrap rather than Portless docs.
2. Validate the upstream dashboard/bootstrap behavior that should replace the current raw URL plus manual token flow.
3. Implement the smallest extension-side changes needed to launch the Control UI with the correct local auth/bootstrap semantics.
4. Add installed-app documentation only after the canonical local path is verified.

## Open Questions

- What exact dashboard bootstrap mechanism should the extension use when opening the local Control UI from Docker Desktop?
- Should the extension surface a tokenized launch action, or should it align with upstream non-tokenized dashboard behavior and a session-scoped token store?
- After the canonical localhost path is fixed, is browser-installed app support sufficient, or does the repo still need a separate “native-feeling app” issue?
