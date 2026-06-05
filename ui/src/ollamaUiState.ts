// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export function ollamaApplyButtonLabel(selectedModel: string, selectedChanged: boolean): string {
  if (!selectedModel.trim()) {
    return 'Choose Model';
  }

  return selectedChanged ? 'Apply and Restart' : 'Already Applied';
}
