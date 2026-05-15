import { describe, expect, it } from 'vitest';

import { buildSdkSafeNodeEvalArgs } from './dockerExec';

describe('Docker Desktop exec helpers', () => {
  it('wraps Node scripts without shell operators in the SDK command argument', () => {
    const args = buildSdkSafeNodeEvalArgs('const fs=require("fs"); process.stdout.write("ok");');

    expect(args.slice(0, 3)).toEqual([
      'node',
      '-e',
      'eval(Buffer.from(process.argv[1],"base64").toString("utf8"))',
    ]);
    expect(args[2]).not.toContain(';');
    expect(args[2]).not.toContain('&&');
    expect(args[2]).not.toContain('|');
    expect(args[3]).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
