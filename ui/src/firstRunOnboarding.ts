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
