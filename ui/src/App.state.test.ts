// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { describe, expect, it } from 'vitest';

import { ollamaApplyButtonLabel } from './ollamaUiState';

describe('App local model state labels', () => {
  it('does not report an empty Ollama selection as already applied', () => {
    expect(ollamaApplyButtonLabel('', false)).toBe('Choose Model');
  });

  it('distinguishes changed and applied Ollama selections', () => {
    expect(ollamaApplyButtonLabel('gemma4:latest', true)).toBe('Apply and Restart');
    expect(ollamaApplyButtonLabel('gemma4:latest', false)).toBe('Already Applied');
  });
});
