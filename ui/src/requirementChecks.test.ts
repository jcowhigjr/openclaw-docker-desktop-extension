import { describe, expect, it } from 'vitest';

import {
  buildDockerPsPortCheckArgs,
  formatStartFailure,
  formatUnknownError,
  parseDockerPublishedPortConflicts,
} from './requirementChecks';

describe('requirement checks', () => {
  it('builds Docker ps args for checking published ports', () => {
    expect(buildDockerPsPortCheckArgs()).toEqual([
      '--format={{json .}}',
    ]);
  });

  it('detects Docker containers already publishing the configured host port', () => {
    const conflicts = parseDockerPublishedPortConflicts(
      [
        'abc123\topenclaw-docker-extension-service\t127.0.0.1:18789->18790/tcp',
        'def456\tother-service\t0.0.0.0:18789->8080/tcp',
        'ghi789\tunrelated\t127.0.0.1:3000->3000/tcp',
      ].join('\n'),
      18789,
      'openclaw-docker-extension-service',
    );

    expect(conflicts).toEqual([
      {
        id: 'def456',
        name: 'other-service',
        ports: '0.0.0.0:18789->8080/tcp',
      },
    ]);
  });

  it('detects Docker port conflicts from JSON-line ps output', () => {
    const conflicts = parseDockerPublishedPortConflicts(
      [
        JSON.stringify({
          ID: 'abc123',
          Names: 'openclaw-docker-extension-service',
          Ports: '127.0.0.1:18789->18790/tcp',
        }),
        JSON.stringify({
          ID: 'def456',
          Names: 'other-service',
          Ports: '127.0.0.1:18789->8080/tcp, [::]:18789->8080/tcp',
        }),
      ].join('\n'),
      18789,
      'openclaw-docker-extension-service',
    );

    expect(conflicts).toEqual([
      {
        id: 'def456',
        name: 'other-service',
        ports: '127.0.0.1:18789->8080/tcp, [::]:18789->8080/tcp',
      },
    ]);
  });

  it('formats Docker port binding failures as user-actionable messages', () => {
    expect(
      formatStartFailure(
        'Error response from daemon: driver failed programming external connectivity on endpoint x: Bind for 127.0.0.1:18789 failed: port is already allocated',
        18789,
      ),
    ).toBe(
      'Host port 18789 is already in use. Change the Host Port in Settings or stop the other process, then try Start again.',
    );
  });

  it('formats Docker engine availability failures as startup guidance', () => {
    expect(formatStartFailure('Cannot connect to the Docker daemon', 18789)).toBe(
      'Docker Desktop is not ready yet. Start Docker Desktop, wait until it finishes starting, then try again.',
    );
  });

  it('formats Docker Desktop SDK error objects without leaking object Object', () => {
    expect(formatUnknownError({ stderr: 'docker daemon unavailable\n' })).toBe('docker daemon unavailable');
    expect(formatUnknownError({ message: 'Docker command failed' })).toBe('Docker command failed');
    expect(formatUnknownError({ code: 1 })).toBe('{"code":1}');
  });
});
