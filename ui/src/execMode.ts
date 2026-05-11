export type ExecutionMode = 'safer' | 'full';

export type JsonObject = Record<string, unknown>;

const OPENCLAW_CONFIG_PATH = '/home/node/.openclaw/openclaw.json';
const EXEC_APPROVALS_PATH = '/home/node/.openclaw/exec-approvals.json';

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

export function buildExecModeReadScript(): string {
  return [
    'const fs=require("fs");',
    'const approvalsPath=' + JSON.stringify(EXEC_APPROVALS_PATH) + ';',
    'const configPath=' + JSON.stringify(OPENCLAW_CONFIG_PATH) + ';',
    'function read(file){if(!fs.existsSync(file)){return {};} return JSON.parse(fs.readFileSync(file,"utf8"));}',
    'const approvals=read(approvalsPath);',
    'const config=read(configPath);',
    'const tools=config.tools?config.tools:{};',
    'process.stdout.write(JSON.stringify({approvals:{defaults:approvals.defaults?approvals.defaults:{}},config:{tools:{exec:tools.exec?tools.exec:{}}}}));',
  ].join(' ');
}

export function buildExecModeWriteScript(mode: ExecutionMode): string {
  const next = buildExecutionModeConfig(mode);

  return [
    'const fs=require("fs");',
    'const path=require("path");',
    'const approvalsPath=' + JSON.stringify(EXEC_APPROVALS_PATH) + ';',
    'const configPath=' + JSON.stringify(OPENCLAW_CONFIG_PATH) + ';',
    'const approvalsDefaults=' + JSON.stringify(next.approvalsDefaults) + ';',
    'const toolsExec=' + JSON.stringify(next.toolsExec) + ';',
    'function read(file){if(!fs.existsSync(file)){return {};} return JSON.parse(fs.readFileSync(file,"utf8"));}',
    'function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true}); if(fs.existsSync(file)){fs.copyFileSync(file,file+".bak");} fs.writeFileSync(file,JSON.stringify(data,null,2)+"\\n");}',
    'const approvals=read(approvalsPath);',
    'const config=read(configPath);',
    'approvals.version=1;',
    'approvals.defaults=Object.assign({},approvals.defaults?approvals.defaults:{},approvalsDefaults);',
    'config.tools=config.tools?config.tools:{};',
    'config.tools.exec=Object.assign({},config.tools.exec?config.tools.exec:{},toolsExec);',
    'writeJson(approvalsPath,approvals);',
    'writeJson(configPath,config);',
  ].join(' ');
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
