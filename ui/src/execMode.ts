export type ExecutionMode = 'safer' | 'full';

export type JsonObject = Record<string, unknown>;

type ExecutionModeConfig = {
  approvalsDefaults: JsonObject;
  toolsExec: JsonObject;
};

export function buildExecutionModeConfig(mode: ExecutionMode): ExecutionModeConfig {
  if (mode === 'full') {
    return {
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
    };
  }

  return {
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
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeExecApprovals(existing: JsonObject, mode: ExecutionMode): JsonObject {
  const next = buildExecutionModeConfig(mode);
  const existingDefaults = isJsonObject(existing.defaults) ? existing.defaults : {};

  return {
    version: 1,
    ...existing,
    defaults: {
      ...existingDefaults,
      ...next.approvalsDefaults,
    },
  };
}

export function mergeOpenClawExecConfig(existing: JsonObject, mode: ExecutionMode): JsonObject {
  const next = buildExecutionModeConfig(mode);
  const existingTools = isJsonObject(existing.tools) ? existing.tools : {};
  const existingExec = isJsonObject(existingTools.exec) ? existingTools.exec : {};

  return {
    ...existing,
    tools: {
      ...existingTools,
      exec: {
        ...existingExec,
        ...next.toolsExec,
      },
    },
  };
}

export function detectExecutionMode(approvals: JsonObject, openclawConfig: JsonObject): ExecutionMode {
  const defaults = isJsonObject(approvals.defaults) ? approvals.defaults : {};
  const tools = isJsonObject(openclawConfig.tools) ? openclawConfig.tools : {};
  const exec = isJsonObject(tools.exec) ? tools.exec : {};
  const approvalsFull =
    defaults.security === 'full' &&
    defaults.ask === 'off' &&
    defaults.askFallback === 'full';
  const configFull = exec.security === 'full' && exec.ask === 'off';

  return approvalsFull && configFull ? 'full' : 'safer';
}

export function parseExecModeReadOutput(stdout: string): {
  approvals: JsonObject;
  config: JsonObject;
  mode: ExecutionMode;
} {
  if (!stdout.trim()) {
    return { approvals: {}, config: {}, mode: 'safer' };
  }

  try {
    const parsed = JSON.parse(stdout) as { approvals?: unknown; config?: unknown };
    const approvals = isJsonObject(parsed.approvals) ? parsed.approvals : {};
    const config = isJsonObject(parsed.config) ? parsed.config : {};
    return {
      approvals,
      config,
      mode: detectExecutionMode(approvals, config),
    };
  } catch {
    return { approvals: {}, config: {}, mode: 'safer' };
  }
}
