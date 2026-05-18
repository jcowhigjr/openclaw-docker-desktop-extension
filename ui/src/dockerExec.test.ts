import { describe, expect, it } from 'vitest';

import { buildRuntimeHelperArgs } from './dockerExec';

describe('Docker Desktop exec helpers', () => {
  it('builds runtime helper argv without inline JavaScript for Docker Desktop SDK', () => {
    const args = buildRuntimeHelperArgs('exec-mode-read');

    expect(args).toEqual([
      'node',
      '/usr/local/bin/openclaw-extension-helper.js',
      'exec-mode-read',
    ]);
    expect(args.join(' ')).not.toContain(' -e ');
    expect(args.join(' ')).not.toContain('eval(');
    expect(args.join(' ')).not.toContain(';');
    expect(args.join(' ')).not.toContain('&&');
    expect(args.join(' ')).not.toContain('|');
  });
});
