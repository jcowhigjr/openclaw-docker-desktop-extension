const RUNTIME_HELPER_PATH = '/usr/local/bin/openclaw-extension-helper.js';

export function buildRuntimeHelperArgs(command: string, args: string[] = []): string[] {
  return ['node', RUNTIME_HELPER_PATH, command, ...args];
}
