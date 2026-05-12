export type PortConflict = {
  id: string;
  name: string;
  ports: string;
};

export function buildDockerPsPortCheckArgs(): string[] {
  return ['--format={{json .}}'];
}

export function parseDockerPublishedPortConflicts(
  stdout: string,
  hostPort: number,
  ownContainerName: string,
): PortConflict[] {
  const conflicts: PortConflict[] = [];
  const portPattern = new RegExp(`(?:^|[,:])(?:0\\.0\\.0\\.0|127\\.0\\.0\\.1|\\[::\\]|::)?[:]${hostPort}->`);

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let id = '';
    let name = '';
    let ports = '';

    if (trimmed.startsWith('{')) {
      try {
        const row = JSON.parse(trimmed) as Record<string, unknown>;
        id = typeof row.ID === 'string' ? row.ID : '';
        name = typeof row.Names === 'string' ? row.Names : '';
        ports = typeof row.Ports === 'string' ? row.Ports : '';
      } catch {
        continue;
      }
    } else {
      [id = '', name = '', ports = ''] = trimmed.split('\t');
    }

    if (!id || !ports || name === ownContainerName) {
      continue;
    }

    if (portPattern.test(ports)) {
      conflicts.push({ id, name, ports });
    }
  }

  return conflicts;
}

export function formatStartFailure(message: string, hostPort: number): string {
  if (/port is already allocated|bind for .* failed|address already in use/i.test(message)) {
    return `Host port ${hostPort} is already in use. Change the Host Port in Settings or stop the other process, then try Start again.`;
  }

  if (/cannot connect to the docker daemon|docker daemon is not running|is the docker daemon running/i.test(message)) {
    return 'Docker Desktop is not ready yet. Start Docker Desktop, wait until it finishes starting, then try again.';
  }

  return message;
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'stderr', 'stdout', 'error']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  return String(error);
}
