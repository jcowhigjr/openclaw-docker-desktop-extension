// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { OllamaModel } from './ollamaSetup';

export type ProviderChoice = 'unset' | 'ollama' | 'anthropic';

export type FirstRunOnboardingPhase = 'fork' | 'free-needs-model' | 'free-ready' | 'resolved';

export type FirstRunOnboardingInput = {
  providerChoice: ProviderChoice;
  configuredOllamaModel: string;
  ollamaModels: OllamaModel[];
};

export function parseProviderChoice(value: unknown): ProviderChoice {
  return value === 'ollama' || value === 'anthropic' ? value : 'unset';
}

const DEMO_ONBOARDING_PHASES: readonly FirstRunOnboardingPhase[] = [
  'fork',
  'free-needs-model',
  'free-ready',
  'resolved',
];

/**
 * Parse a demo-only `onboarding=<phase>` query flag into a forced onboarding
 * phase, so the screenshot pipeline can render each first-run screen without
 * live first-run state. Returns null when the flag is absent or invalid.
 */
export function parseDemoOnboardingPhase(search: string): FirstRunOnboardingPhase | null {
  const value = new URLSearchParams(search).get('onboarding');
  return DEMO_ONBOARDING_PHASES.find((phase) => phase === value) ?? null;
}

export function inferProviderChoiceFromExistingState(
  providerChoice: ProviderChoice,
  configuredOllamaModel: string,
): ProviderChoice {
  if (providerChoice !== 'unset') {
    return providerChoice;
  }

  return configuredOllamaModel.trim() ? 'ollama' : 'unset';
}

export function deriveOnboardingPhase(input: FirstRunOnboardingInput): FirstRunOnboardingPhase {
  const providerChoice = inferProviderChoiceFromExistingState(
    input.providerChoice,
    input.configuredOllamaModel,
  );

  if (providerChoice === 'anthropic') {
    return 'resolved';
  }

  if (providerChoice === 'ollama') {
    if (input.configuredOllamaModel.trim()) {
      return 'resolved';
    }

    return input.ollamaModels.length > 0 ? 'free-ready' : 'free-needs-model';
  }

  return input.ollamaModels.length > 0 ? 'free-ready' : 'fork';
}

export function isChatGated(
  providerChoice: ProviderChoice,
  configuredOllamaModel: string,
): boolean {
  const resolvedChoice = inferProviderChoiceFromExistingState(providerChoice, configuredOllamaModel);
  if (resolvedChoice === 'unset') {
    return true;
  }

  return resolvedChoice === 'ollama' && !configuredOllamaModel.trim();
}

export function chatGateMessage(
  providerChoice: ProviderChoice,
  configuredOllamaModel: string,
): string {
  const resolvedChoice = inferProviderChoiceFromExistingState(providerChoice, configuredOllamaModel);
  if (resolvedChoice === 'ollama') {
    return 'OpenClaw chat is waiting on a local model. Apply a detected Ollama model before opening the Control UI.';
  }

  return 'Choose Free Local or Hosted before opening the Control UI so the first chat does not fail on the default Anthropic provider.';
}

export function ollamaOnboardingActionLabel(
  recommendedModel: string,
  configuredOllamaModel: string,
): string {
  const model = recommendedModel.trim();
  if (!model) {
    return 'Detect Models';
  }

  return model === configuredOllamaModel.trim()
    ? `Already Using ${model}`
    : `Use ${model}`;
}

export function formatOllamaPullCommand(model = 'gemma4:latest'): string {
  const normalized = model.trim() || 'gemma4:latest';
  return `ollama pull ${normalized}`;
}
