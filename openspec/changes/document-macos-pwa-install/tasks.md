## 1. Architecture Validation

- [ ] 1.1 Verify the upstream dashboard/bootstrap behavior that should be preserved for the extension-managed localhost Control UI.
- [ ] 1.2 Decide the canonical local origin and launch model for an installed-app-friendly flow, explicitly rejecting Portless as the default architecture.

## 2. Extension Launch Flow

- [ ] 2.1 Replace the current raw URL plus manual token-copy launch behavior with an extension-side Control UI bootstrap flow that matches upstream local dashboard semantics.
- [ ] 2.2 Promote any required gateway web-surface settings into explicit extension-owned runtime configuration rather than ad hoc container edits.

## 3. Installed-App Guidance

- [ ] 3.1 Add documentation for installing the canonical localhost Control UI as a standalone browser app on macOS without introducing proxy-specific certificate or origin workarounds.
- [ ] 3.2 Cross-check the docs and issue wording against issue `#12` and the repo's isolation language so the flow is presented as optional Post-Traction polish, not as a new trust-boundary claim.
