// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/token=[A-Za-z0-9._-]+/g, 'token=[REDACTED]')
    .replace(/\/(Users|home)\/[^/\s]+/g, '/$1/~');
}
