// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
const RUNTIME_HELPER_PATH = '/usr/local/bin/openclaw-extension-helper.js';

export function buildRuntimeHelperArgs(command: string, args: string[] = []): string[] {
  return ['node', RUNTIME_HELPER_PATH, command, ...args];
}
