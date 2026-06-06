## ADDED Requirements

### Requirement: First-run provider selection

On a fresh install (no provider choice persisted), the extension SHALL present a provider-selection step offering exactly two paths — Free local (Ollama) and Hosted (Anthropic API key) — before the user is directed to chat. The system SHALL NOT silently default to the hosted `anthropic` provider.

#### Scenario: Fresh install shows the fork

- **WHEN** the extension loads and no provider choice is persisted
- **THEN** the onboarding presents a "Free local (Ollama)" option and a "Hosted (paste Anthropic key)" option
- **AND** neither provider is treated as configured until the user completes one path

#### Scenario: Choice is persisted

- **WHEN** the user completes either onboarding path
- **THEN** the chosen provider is saved to the extension config
- **AND** the onboarding step is not shown again on subsequent opens unless the user resets it

### Requirement: Auto-detect and pre-select the free local path

When a host Ollama model is already detected during onboarding, the system SHALL pre-select the Free local path and offer a single action to apply that model as the OpenClaw default.

#### Scenario: Host Ollama model present

- **WHEN** onboarding runs and host Ollama is reachable with at least one installed model
- **THEN** the Free local path is pre-selected
- **AND** a one-click "Use <model>" action applies it as the OpenClaw default and marks onboarding complete

#### Scenario: User overrides the pre-selection

- **WHEN** the Free local path is pre-selected but the user chooses Hosted instead
- **THEN** the Hosted path is followed and no Ollama default is applied

### Requirement: Chat is gated until a usable provider is configured

The extension SHALL NOT surface the raw `No API key found for provider "anthropic"` error as a first-run experience. Until a usable provider is configured, the UI SHALL present a clear "choose a provider / pick a model first" state.

#### Scenario: No provider configured

- **WHEN** the user attempts to open chat and no provider has been configured through onboarding
- **THEN** the UI shows a clear call-to-action to complete onboarding
- **AND** the cryptic missing-API-key error is not shown as the primary message

#### Scenario: Free local selected but no model applied

- **WHEN** the user selected Free local but has not yet applied a model
- **THEN** the UI indicates a model must be selected before chatting

### Requirement: Guided remediation when the free path has no model

When the user chooses Free local but host Ollama is unreachable or has no installed model, the system SHALL present an actionable remediation instead of a dead-end message.

#### Scenario: Ollama not reachable

- **WHEN** the Free local path is chosen and host Ollama cannot be reached
- **THEN** the UI shows an actionable CTA to install and start Ollama (with a link)

#### Scenario: Ollama reachable but no models installed

- **WHEN** the Free local path is chosen and host Ollama responds with zero installed models
- **THEN** the UI shows a copyable `ollama pull <model>` command and a re-detect action
