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

// Whether an existing service container must be recreated to run the image
// pinned by this extension build (#249). Docker reports the image reference
// the container was created from, or a bare image ID once that tag has moved
// on (e.g. after a local rebuild); either way, anything but the pinned
// reference means the service is not running this release. An unknown image
// is left alone rather than recreated on a guess.
export function needsRuntimeRecreate(containerImage: string | undefined, pinnedImage: string): boolean {
  const current = containerImage?.trim();
  return Boolean(current) && current !== pinnedImage.trim();
}

// Seconds Docker waits after SIGTERM before killing the service. The runtime
// entrypoint forwards SIGTERM so the gateway can release its owner lease on the
// state volume. A killed gateway (`docker rm -f`) leaves that lease held, and a
// new container on the same volume then refuses to start until it expires
// (300s). Always stop the service before removing it.
const SERVICE_STOP_TIMEOUT_SECONDS = 20;

export function buildServiceStopArgs(containerId: string): string[] {
  return ['-t', String(SERVICE_STOP_TIMEOUT_SECONDS), containerId];
}
