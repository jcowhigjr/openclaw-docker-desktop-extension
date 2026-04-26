## ADDED Requirements

### Requirement: Extension SHALL preserve one canonical local Control UI origin
The extension SHALL treat the localhost-served OpenClaw gateway UI as the canonical browser origin for the extension-managed service and SHALL NOT require an alternate proxy hostname for the default installed-app flow.

#### Scenario: User launches the Control UI from the extension
- **WHEN** a user opens the Control UI from the Docker Desktop extension
- **THEN** the launch flow uses the canonical local gateway-served UI origin
- **AND** the default experience does not depend on Portless, certificate bypass, or a non-loopback origin allowlist

### Requirement: Extension SHALL bootstrap Control UI auth using the intended local dashboard flow
The extension SHALL launch the local Control UI using a bootstrap/auth flow that matches the upstream gateway dashboard semantics instead of requiring the user to manually assemble a connection from a raw WebSocket URL and separately copied token.

#### Scenario: User opens the local admin UI for the first time
- **WHEN** a user launches the Control UI from the extension
- **THEN** the browser receives the information needed to authenticate the current session using the intended local dashboard flow
- **AND** the extension does not require the user to manually paste the shared gateway token as the primary launch path

### Requirement: Installed-app guidance SHALL target the canonical local origin
The project SHALL document standalone browser-app installation on macOS only for the canonical local Control UI flow that the extension officially supports.

#### Scenario: Reader follows the installed-app documentation
- **WHEN** a user reads the macOS installed-app guidance
- **THEN** the guidance points at the canonical local Control UI origin
- **AND** the guidance does not require Portless-specific hostname, certificate, or origin-allowlist steps for the default path

### Requirement: Proxy-hosted exploration SHALL be documented only as non-default validation context
If the project references Portless or other alternate-hostname exploration, it SHALL present that material as exploratory validation context and not as the recommended architecture for the standalone-app experience.

#### Scenario: Reader encounters proxy-related notes
- **WHEN** a reader sees notes about Portless or alternate origins
- **THEN** the project clarifies that those experiments exposed origin/auth/certificate concerns
- **AND** the project keeps the recommended architecture centered on the canonical localhost flow
