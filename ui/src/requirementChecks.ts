// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
export type PortConflict = {
  id: string;
  name: string;
  ports: string;
};

export type RequirementSeverity = 'success' | 'warning' | 'info';

export type OllamaRequirementStatus = {
  severity: RequirementSeverity;
  debug: string;
  status: string;
};

export function buildDockerPsPortCheckArgs(): string[] {
  return ['--format={{.ID}}|{{.Names}}|{{.Ports}}'];
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
    } else if (trimmed.includes('|')) {
      [id = '', name = '', ports = ''] = trimmed.split('|');
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

export function formatOllamaRequirementStatus({
  hostPort,
  configuredOllamaModel,
  ollamaReachable,
}: {
  hostPort: number;
  configuredOllamaModel: string;
  ollamaReachable: boolean;
}): OllamaRequirementStatus {
  if (configuredOllamaModel) {
    if (ollamaReachable) {
      return {
        severity: 'success',
        debug: `requirements check passed: Docker, host port ${hostPort}, and Ollama are ready`,
        status: `Docker is ready, host port ${hostPort} is available, and host Ollama is reachable for ${configuredOllamaModel}.`,
      };
    }

    return {
      severity: 'warning',
      debug: `requirements check passed: Docker is ready and host port ${hostPort} is available`,
      status: `Docker is ready and host port ${hostPort} is available, but host Ollama was not reachable. Start Ollama before using the configured local model ${configuredOllamaModel}.`,
    };
  }

  if (ollamaReachable) {
    return {
      severity: 'success',
      debug: `requirements check passed: Docker, host port ${hostPort}, and host Ollama are ready`,
      status: `Docker is ready, host port ${hostPort} is available, and host Ollama is reachable for Local Model Setup.`,
    };
  }

  return {
    severity: 'info',
    debug: `requirements check passed: Docker is ready and host port ${hostPort} is available`,
    status: `Docker is ready and host port ${hostPort} is available. Host Ollama was not reachable yet, so start Ollama before using Local Model Setup.`,
  };
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
