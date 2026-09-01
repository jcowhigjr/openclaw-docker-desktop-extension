// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import {
  buildOllamaTagsFetchArgs,
  buildOllamaWarmupArgs,
  chooseRecommendedOllamaModel,
  normalizeOllamaModelName,
  parseOllamaTags,
  type OllamaModel,
} from './ollamaSetup';
import { classifyError, classifyOllamaTags, getRemedy, getTitle } from './diag/errorCodes';
import { captureOllamaSnapshot, hasOllamaInvariantViolation } from './diag/snapshot';
import { traceAction } from './diag/trace';
import { formatUnknownError } from './requirementChecks';

type CommandResult = { stdout?: string; stderr?: string };
type CommandRunner = (cmd: string, args: string[]) => Promise<CommandResult>;

// /api/tags lists models from disk and returns 200 even when Ollama cannot
// load a single one (e.g. a Metal/GPU backend fault). A bounded load probe
// after the tags parse is the only way to catch that before the user hits an
// opaque chat timeout. Keep this well under the overall detect budget: a
// timeout here must not read as "Ollama is broken" (see isProbeTimeout).
const MODEL_PROBE_TIMEOUT_SECONDS = 20;

// Curl reports a timed-out request in more than one way depending on version
// and platform (exit code 28, "Operation timed out", a bare "timed out", or --
// once formatUnknownError falls back to JSON.stringify on a plain rejection
// object like `{ code: 28 }` -- the `"code":28` JSON form). Match all of them
// case-insensitively and defensively: a cold load that trips the 20s bound is
// not a broken Ollama, and misclassifying an unfamiliar timeout message as a
// hard failure would incorrectly demote severity.
//
// The probe is built with `curl -fsS`: `-f` makes curl fail silently and
// discard the HTTP response body on a server error, so a genuine Ollama
// failure currently reaches this function only as something like
// "curl: (22) The requested URL returned error: 500" -- never containing a
// timeout token. That is the only reason the loose 'timeout'/'timed out'
// substring match below is safe today: if `-f` is ever dropped, the response
// body could carry Ollama's own runner-crash string, "timed out waiting for
// llama runner to start" -- precisely the fault OLM-006 exists to catch. The
// guard below keeps that case from being swallowed by treating a message that
// looks like a received HTTP response as never a timeout, regardless of what
// substrings it contains.
function isProbeTimeout(message: string): boolean {
  const lower = message.toLowerCase();
  const looksLikeHttpResponse = /\(22\)/.test(lower) || lower.includes('returned error');
  if (looksLikeHttpResponse) {
    return false;
  }
  return (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    /\bexit code:?\s*28\b/.test(lower) ||
    /\(28\)/.test(lower) ||
    /"code"\s*:\s*28\b/.test(lower)
  );
}

// Shared membership check: a persisted UI selection or an openclaw config
// value can name a model that is no longer present in the host's model list
// (e.g. the user deleted it). `finalize` clears exactly that case before
// returning it to the UI, and the load probe below must use the same check
// to gate itself -- probing a model that isn't installed produces a 404 that
// looks identical to a broken Ollama.
function isModelInstalled(models: OllamaModel[], candidate: string): boolean {
  return candidate !== '' && models.some((model) => model.name === candidate);
}

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
      if (!isModelInstalled(params.models, selected)) {
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
      const raw = formatUnknownError(error);
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
      const raw = formatUnknownError(error);
      const classification = classifyError('ollama.config_get', raw);
      step('config_get', classification.code === 'OLM-001' ? 'ok' : 'warning', {
        code: classification.code,
        error: { message: raw },
      });
    }

    const selected = initialSelected || configured || chooseRecommendedOllamaModel(models);

    let severity: DetectOutput['severity'] = models.length > 0 ? 'success' : 'info';
    let status =
      models.length > 0
        ? `Detected ${models.length} host Ollama model${models.length === 1 ? '' : 's'}.`
        : 'Host Ollama responded, but no models were installed.';
    let code: string | undefined;

    // Only probe when the selection actually names an installed model. A
    // persisted UI choice or openclaw config value can point at a model that
    // was since deleted; probing that name would 404 and look identical to a
    // broken Ollama, so this uses the same membership check `finalize` uses
    // to silently clear a stale selection. With no models installed (or no
    // resolvable selection) the state is already reported by the severity
    // set above.
    if (isModelInstalled(models, selected)) {
      try {
        await input.run('exec', [
          containerId,
          ...buildOllamaWarmupArgs(selected, MODEL_PROBE_TIMEOUT_SECONDS),
        ]);
        step('model_probe', 'ok');
      } catch (error) {
        const raw = formatUnknownError(error);
        if (isProbeTimeout(raw)) {
          // A slow cold load is not a broken Ollama: leave severity as-is and
          // only surface it in the trace as a warning.
          step('model_probe', 'warning', { error: { message: raw } });
        } else {
          const classification = classifyError('ollama.model_probe', raw);
          step('model_probe', 'error', { code: classification.code, error: { message: raw } });
          severity = 'error';
          status = `${getTitle(classification.code)}: ${raw} [${classification.code}] ${getRemedy(
            classification.code,
          )}`;
          code = classification.code;
        }
      }
    }

    return finalize({
      models,
      configured,
      selected,
      severity,
      status,
      code,
    });
  });
}
