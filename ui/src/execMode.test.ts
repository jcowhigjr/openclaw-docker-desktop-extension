import { describe, expect, it } from 'vitest';

import {
  buildExecModeReadScript,
  buildExecModeWriteScript,
  buildExecutionModeConfig,
  detectExecutionMode,
  mergeExecApprovals,
  mergeOpenClawExecConfig,
} from './execMode';

describe('execution mode config', () => {
  it('builds safer mode with allowlist prompts and deny fallback', () => {
    expect(buildExecutionModeConfig('safer')).toEqual({
      approvalsDefaults: {
        security: 'allowlist',
        ask: 'on-miss',
        askFallback: 'deny',
        autoAllowSkills: false,
      },
      toolsExec: {
        host: 'gateway',
        security: 'allowlist',
        ask: 'on-miss',
      },
    });
  });

  it('builds full access mode with prompts off and full fallback', () => {
    expect(buildExecutionModeConfig('full')).toEqual({
      approvalsDefaults: {
        security: 'full',
        ask: 'off',
        askFallback: 'full',
        autoAllowSkills: false,
      },
      toolsExec: {
        host: 'gateway',
        security: 'full',
        ask: 'off',
      },
    });
  });

  it('merges approvals without losing socket or allowlist state', () => {
    const merged = mergeExecApprovals(
      {
        version: 1,
        socket: {
          path: '/home/node/.openclaw/exec-approvals.sock',
          token: 'preserved',
        },
        defaults: {
          security: 'full',
          ask: 'off',
          askFallback: 'full',
        },
        agents: {
          main: {
            allowlist: [
              {
                id: 'entry-1',
                pattern: '/usr/bin/ls',
              },
            ],
          },
        },
      },
      'safer',
    );

    expect(merged.socket).toEqual({
      path: '/home/node/.openclaw/exec-approvals.sock',
      token: 'preserved',
    });
    expect(merged.agents).toEqual({
      main: {
        allowlist: [
          {
            id: 'entry-1',
            pattern: '/usr/bin/ls',
          },
        ],
      },
    });
    expect(merged.defaults).toEqual({
      security: 'allowlist',
      ask: 'on-miss',
      askFallback: 'deny',
      autoAllowSkills: false,
    });
  });

  it('merges OpenClaw tools.exec without clobbering unrelated config', () => {
    const merged = mergeOpenClawExecConfig(
      {
        gateway: { auth: { token: 'keep' } },
        tools: {
          other: true,
          exec: {
            strictInlineEval: true,
          },
        },
      },
      'full',
    );

    expect(merged.gateway).toEqual({ auth: { token: 'keep' } });
    expect(merged.tools).toEqual({
      other: true,
      exec: {
        strictInlineEval: true,
        host: 'gateway',
        security: 'full',
        ask: 'off',
      },
    });
  });

  it('detects full only when both config layers are full access', () => {
    expect(
      detectExecutionMode(
        { defaults: { security: 'full', ask: 'off', askFallback: 'full' } },
        { tools: { exec: { security: 'full', ask: 'off' } } },
      ),
    ).toBe('full');
    expect(
      detectExecutionMode(
        { defaults: { security: 'full', ask: 'off', askFallback: 'full' } },
        { tools: { exec: { security: 'allowlist', ask: 'on-miss' } } },
      ),
    ).toBe('safer');
  });

  it('builds a Docker SDK-safe write script for both config files', () => {
    const script = buildExecModeWriteScript('full');

    expect(script).toContain('/home/node/.openclaw/exec-approvals.json');
    expect(script).toContain('/home/node/.openclaw/openclaw.json');
    expect(script).toContain('copyFileSync');
    expect(script).not.toContain('&&');
    expect(script).not.toContain('|');
  });

  it('builds a read script that does not return socket token fields', () => {
    const script = buildExecModeReadScript();

    expect(script).toContain('approvals:{defaults:approvals.defaults');
    expect(script).not.toContain('socket');
    expect(script).not.toContain('token');
    expect(script).not.toContain('&&');
    expect(script).not.toContain('|');
  });
});
