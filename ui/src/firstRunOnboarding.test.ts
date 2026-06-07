// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import {
  deriveOnboardingPhase,
  formatOllamaPullCommand,
  inferProviderChoiceFromExistingState,
  isChatGated,
  ollamaOnboardingActionLabel,
  parseProviderChoice,
} from './firstRunOnboarding';

describe('firstRunOnboarding', () => {
  it('defaults unknown persisted provider choices to unset', () => {
    expect(parseProviderChoice(undefined)).toBe('unset');
    expect(parseProviderChoice('something-else')).toBe('unset');
    expect(parseProviderChoice('ollama')).toBe('ollama');
    expect(parseProviderChoice('anthropic')).toBe('anthropic');
  });

  it('keeps the persisted provider choice when already set', () => {
    expect(inferProviderChoiceFromExistingState('anthropic', 'gemma4:latest')).toBe('anthropic');
    expect(inferProviderChoiceFromExistingState('ollama', '')).toBe('ollama');
  });

  it('infers ollama for upgraders with an existing configured local model', () => {
    expect(inferProviderChoiceFromExistingState('unset', 'gemma4:latest')).toBe('ollama');
  });

  it('returns fork while the provider is still unset', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'unset',
        configuredOllamaModel: '',
        ollamaModels: [],
      }),
    ).toBe('fork');
  });

  it('pre-selects the free path when provider is unset and host models are available', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'unset',
        configuredOllamaModel: '',
        ollamaModels: [{ name: 'gemma4:latest' }],
      }),
    ).toBe('free-ready');
  });

  it('returns free-ready when ollama is chosen and host models are available', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'ollama',
        configuredOllamaModel: '',
        ollamaModels: [{ name: 'gemma4:latest' }],
      }),
    ).toBe('free-ready');
  });

  it('returns free-needs-model when ollama is chosen and no models are detected', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'ollama',
        configuredOllamaModel: '',
        ollamaModels: [],
      }),
    ).toBe('free-needs-model');
  });

  it('treats configured ollama installs as resolved for upgraders', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'unset',
        configuredOllamaModel: 'gemma4:latest',
        ollamaModels: [],
      }),
    ).toBe('resolved');
  });

  it('treats the hosted choice as resolved', () => {
    expect(
      deriveOnboardingPhase({
        providerChoice: 'anthropic',
        configuredOllamaModel: '',
        ollamaModels: [],
      }),
    ).toBe('resolved');
  });

  it('gates chat until a provider path is usable', () => {
    expect(isChatGated('unset', '')).toBe(true);
    expect(isChatGated('ollama', '')).toBe(true);
    expect(isChatGated('ollama', 'gemma4:latest')).toBe(false);
    expect(isChatGated('anthropic', '')).toBe(false);
  });

  it('formats the ollama onboarding action label from model state', () => {
    expect(ollamaOnboardingActionLabel('', '')).toBe('Detect Models');
    expect(ollamaOnboardingActionLabel('gemma4:latest', '')).toBe('Use gemma4:latest');
    expect(ollamaOnboardingActionLabel('gemma4:latest', 'gemma4:latest')).toBe(
      'Already Using gemma4:latest',
    );
  });

  it('formats the default ollama pull command for remediation', () => {
    expect(formatOllamaPullCommand()).toBe('ollama pull gemma4:latest');
    expect(formatOllamaPullCommand('llama3.2:latest')).toBe('ollama pull llama3.2:latest');
    expect(formatOllamaPullCommand('')).toBe('ollama pull gemma4:latest');
  });
});
