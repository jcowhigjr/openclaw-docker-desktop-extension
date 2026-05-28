// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
type RuntimeRunArgsOptions = {
  containerName: string;
  image: string;
  volumeName: string;
  hostPort: number;
  bridgePort: number;
  labels: Record<string, string>;
};

const RUNTIME_PLATFORM = 'linux/arm64';
const RUNTIME_SECURITY_ARGS = [
  '--read-only',
  '--tmpfs',
  '/tmp:rw,noexec,nosuid,size=64m',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--ulimit',
  'nofile=1024:1024',
];

export function buildRuntimeRunArgs(options: RuntimeRunArgsOptions): string[] {
  return [
    '-d',
    '--name',
    options.containerName,
    '--platform',
    RUNTIME_PLATFORM,
    ...RUNTIME_SECURITY_ARGS,
    '-v',
    `${options.volumeName}:/home/node`,
    '-p',
    `127.0.0.1:${options.hostPort}:${options.bridgePort}`,
    ...Object.entries(options.labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]),
    options.image,
  ];
}
