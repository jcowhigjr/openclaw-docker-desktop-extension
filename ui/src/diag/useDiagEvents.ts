// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import { useSyncExternalStore } from 'react';

import { formatDiagEvent, readDiagEvents, subscribeDiagEvents } from './events';

export function getDiagLogText(): string {
  return readDiagEvents().map((event) => formatDiagEvent(event)).join('\n');
}

export function useDiagLogText(): string {
  return useSyncExternalStore(subscribeDiagEvents, getDiagLogText, getDiagLogText);
}
