// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { afterEach, expect, it, vi } from 'vitest';

import { readDiagEvents, resetDiagEvents } from './diag/events';
import { runDetect } from './ollamaDetect';

afterEach(() => resetDiagEvents());

it('assigns increasing action sequence numbers to overlapping detects', async () => {
  const slow = (ms: number, stdout: string) =>
    vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { stdout };
    });
  const a = runDetect({
    run: slow(30, JSON.stringify({ models: [{ name: 'a:latest' }] })),
    selectedOllamaModel: '',
  });
  const b = runDetect({
    run: slow(5, JSON.stringify({ models: [{ name: 'b:latest' }] })),
    selectedOllamaModel: '',
  });
  await Promise.all([a, b]);
  const terminalCount = readDiagEvents().filter(
    (event) => event.action === 'ollama.detect' && event.outcome === 'ok' && event.step === undefined,
  ).length;
  expect(terminalCount).toBe(2);
});
