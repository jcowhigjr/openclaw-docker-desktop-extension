// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import {
  buildOllamaTagsFetchArgs,
  chooseRecommendedOllamaModel,
  normalizeOllamaModelName,
  parseOllamaTags,
  type OllamaModel,
} from './ollamaSetup';
import { classifyError, classifyOllamaTags, getRemedy, getTitle } from './diag/errorCodes';
import { captureOllamaSnapshot, hasOllamaInvariantViolation } from './diag/snapshot';
import { traceAction } from './diag/trace';

type CommandResult = { stdout?: string; stderr?: string };
type CommandRunner = (cmd: string, args: string[]) => Promise<CommandResult>;

export type DetectInput = {
  run: CommandRunner;
  containerId?: string;
  selectedOllamaModel?: string;
  phase?: string;
};

export type DetectOutput = {
  models: OllamaModel[];
  configuredOllamaModel: string;
  selectedOllamaModel: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  status: string;
  code?: string;
};

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

export async function runDetect(input: DetectInput): Promise<DetectOutput> {
  const containerId = input.containerId ?? 'test-container';
  const initialSelected = input.selectedOllamaModel ?? '';

  return traceAction('ollama.detect', async ({ step, actionSeq, setTerminalAttrs }) => {
    const finalize = (params: {
      models: OllamaModel[];
      configured: string;
      selected: string;
      severity: DetectOutput['severity'];
      status: string;
      code?: string;
    }): DetectOutput => {
      let selected = params.selected;
      if (selected !== '' && !params.models.some((model) => model.name === selected)) {
        selected = '';
      }

      const state = {
        phase: input.phase ?? 'running',
        busy: false,
        ollamaChecking: false,
        ollamaStatus: params.status,
        ollamaAlertSeverity: params.severity,
        selectedOllamaModel: selected,
        configuredOllamaModel: params.configured,
        models: params.models,
        actionSeq,
        appliedSeq: actionSeq,
      };
      const snapshot = captureOllamaSnapshot(state);
      setTerminalAttrs(snapshot);
      if (params.severity !== 'success' || hasOllamaInvariantViolation(state)) {
        step('snapshot', params.severity === 'error' ? 'error' : 'warning', { attrs: snapshot });
      }

      return {
        models: params.models,
        configuredOllamaModel: params.configured,
        selectedOllamaModel: selected,
        severity: params.severity,
        status: params.status,
        code: params.code,
      };
    };

    let tagsStdout: string;
    try {
      const result = await input.run('exec', [containerId, ...buildOllamaTagsFetchArgs()]);
      tagsStdout = asText(result.stdout);
      step('tags_fetch', 'ok');
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const classification = classifyError('ollama.tags_fetch', raw);
      step('tags_fetch', 'error', { code: classification.code, error: { message: raw } });
      return finalize({
        models: [],
        configured: '',
        selected: '',
        severity: 'error',
        status: `Could not reach host Ollama from OpenClaw: ${raw} [${classification.code}] ${getRemedy(
          classification.code,
        )}`,
        code: classification.code,
      });
    }

    const tags = parseOllamaTags(tagsStdout);
    if (!tags.ok) {
      const classification = classifyOllamaTags(tags);
      const code = classification.code ?? 'OLM-005';
      step('tags_parse', 'warning', { code });
      return finalize({
        models: [],
        configured: '',
        selected: '',
        severity: 'warning',
        status: `${getTitle(code)} [${code}] ${getRemedy(code)}`,
        code,
      });
    }

    const models = tags.models;
    let configured = '';
    try {
      const result = await input.run('exec', [
        containerId,
        'node',
        'openclaw.mjs',
        'config',
        'get',
        'agents.defaults.model.primary',
      ]);
      configured = normalizeOllamaModelName(asText(result.stdout));
      step('config_get', 'ok');
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const classification = classifyError('ollama.config_get', raw);
      step('config_get', classification.code === 'OLM-001' ? 'ok' : 'warning', {
        code: classification.code,
        error: { message: raw },
      });
    }

    const selected = initialSelected || configured || chooseRecommendedOllamaModel(models);
    return finalize({
      models,
      configured,
      selected,
      severity: models.length > 0 ? 'success' : 'info',
      status:
        models.length > 0
          ? `Detected ${models.length} host Ollama model${models.length === 1 ? '' : 's'}.`
          : 'Host Ollama responded, but no models were installed.',
    });
  });
}
