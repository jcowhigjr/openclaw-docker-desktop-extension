## 1. Config And Detection

- [x] 1.1 Add an update-policy field to the saved extension config and default existing installs safely.
- [x] 1.2 Add a helper that classifies runtime images as pinned or updateable channel references.
- [x] 1.3 Add a helper that compares the local runtime image with the remote published image and returns update state plus non-fatal warnings.

## 2. UI And Launch Flow

- [x] 2.1 Add a top-level update banner that shows current versus available image information and exposes a manual update action.
- [x] 2.2 Trigger update checks on extension open and before launch for updateable images.
- [x] 2.3 Implement the auto-before-launch policy by pulling the newer image and recreating the container with the existing volume, port, and saved settings.

## 3. Verification And Docs

- [x] 3.1 Add focused tests for pinned-versus-floating image handling, update-check failure handling, and recreate-on-update behavior.
- [x] 3.2 Update the README to explain the new update policy, when it runs, and that “what’s new” is still out of scope.
- [ ] 3.3 Re-verify the extension’s existing start, restart, and provider-auth flows after the update path is added.
