## ADDED Requirements

### Requirement: Extension can detect newer published runtime images for updateable channels
The extension SHALL check for a newer published OpenClaw runtime image when the configured runtime image uses an updateable channel reference rather than a pinned version tag.

#### Scenario: Updateable image is configured
- **WHEN** the saved runtime image refers to an updateable published channel such as a floating or channel tag
- **THEN** the extension performs a remote comparison on open and before launch

#### Scenario: Pinned image is configured
- **WHEN** the saved runtime image refers to a pinned version tag
- **THEN** the extension does not treat that image as auto-updateable

### Requirement: Extension presents update availability without blocking normal use
The extension SHALL surface update availability in the main UI and SHALL not treat registry lookup failures as fatal to normal launch.

#### Scenario: Newer image is available
- **WHEN** the remote published image differs from the local image currently used by the service container
- **THEN** the extension shows an update notice that identifies the running image and the available image

#### Scenario: Update check fails
- **WHEN** the extension cannot complete the remote update check because of auth, rate limit, or network failure
- **THEN** the extension records a non-fatal warning and still allows the user to launch the current image

### Requirement: Extension can apply an update before launch while preserving state
The extension SHALL support a configurable policy that can automatically apply a newer published runtime image before launch, while preserving the existing named volume and saved settings.

#### Scenario: Auto-before-launch policy is enabled
- **WHEN** a newer updateable runtime image is available and the user opens the extension or launches OpenClaw
- **THEN** the extension pulls the newer image, recreates the service container with the existing config, and starts OpenClaw using the preserved volume

#### Scenario: Manual update policy is enabled
- **WHEN** a newer updateable runtime image is available and automatic apply is disabled
- **THEN** the extension offers a user-triggered update action and does not replace the running container until the user chooses it
