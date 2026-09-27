// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Alert,
  AlertColor,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDDClient, isDemoMode } from './dockerDesktopClient';
import {
  buildOllamaTagsFetchArgs,
  buildOllamaWarmupArgs,
  chooseRecommendedOllamaModel,
  formatOllamaModelSize,
  type OllamaModel,
} from './ollamaSetup';
import { ollamaApplyButtonLabel } from './ollamaUiState';
import { getCondensedGuidance } from './ollamaGuidance';
import { runDetect } from './ollamaDetect';
import { buildControlUiLaunchUrl } from './controlUiLaunch';
import { appendDebugEntry } from './debugLog';
import { buildDiagnosticsBundle } from './diag/bundle';
import { readDiagEvents, resetDiagEvents } from './diag/events';
import { captureOllamaSnapshot } from './diag/snapshot';
import { traceAction, type StepFn } from './diag/trace';
import { useDiagLogText } from './diag/useDiagEvents';
import { buildRuntimeHelperArgs } from './dockerExec';
import { readGatewayTokenWithRetry } from './tokenRetry';
import {
  DEFAULT_EXECUTION_MODE,
  parseExecModeReadOutput,
  type ExecutionMode,
} from './execMode';
import { buildRuntimeRunArgs, buildServiceStopArgs, needsRuntimeRecreate } from './runtimeContainer';
import { getGatewayTokenHelperText, type TokenStatus } from './tokenStatus';
import {
  buildDockerPsPortCheckArgs,
  formatOllamaRequirementStatus,
  formatStartFailure,
  formatUnknownError,
  parseDockerPublishedPortConflicts,
} from './requirementChecks';
import {
  chatGateMessage,
  deriveOnboardingPhase,
  formatOllamaPullCommand,
  isChatGated,
  ollamaOnboardingActionLabel,
  parseDemoOnboardingPhase,
  parseProviderChoice,
  type ProviderChoice,
} from './firstRunOnboarding';

type ContainerPhase = 'missing' | 'running' | 'stopped' | 'starting' | 'error';

type ExtensionConfig = {
  port: number;
  autoStart: boolean;
  providerChoice: ProviderChoice;
};

type ContainerSnapshot = {
  id: string;
  state: string;
  status: string;
  image?: string;
};

type CliExecResult = {
  stdout?: string;
  stderr?: string;
};

type RefreshResult = {
  phase: ContainerPhase;
  ready: boolean;
};

const STORAGE_KEY = 'openclaw-docker-extension-config';
const OLLAMA_BANNER_DISMISS_KEY = 'openclaw-docker-extension-ollama-banner-dismissed';
const CONTAINER_NAME = 'openclaw-docker-extension-service';
const VOLUME_NAME = 'openclaw-docker-extension-home';
const BRIDGE_PORT = 18790;
// The runtime image is pinned per extension release at build time. There is no
// setting to change it and no separate runtime update: installing a newer
// extension is how OpenClaw updates, and Start recreates a service created from
// any other image (#249).
const RUNTIME_IMAGE = (import.meta.env.VITE_DEFAULT_RUNTIME_IMAGE || 'ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:latest') as string;
const DEFAULT_OLLAMA_ONBOARDING_MODEL = 'gemma4:latest';
const DEFAULT_CONFIG: ExtensionConfig = {
  port: 18789,
  autoStart: true,
  providerChoice: 'unset',
};
const LABELS = {
  'com.docker.extension.openclaw': 'true',
  'com.docker.extension.openclaw.role': 'service',
};
function loadConfig(): ExtensionConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONFIG;
    }

    // Older builds also stored an `image`; it is ignored, since the runtime is
    // pinned to this build.
    const parsed = JSON.parse(raw) as Partial<ExtensionConfig>;
    return {
      port: typeof parsed.port === 'number' && Number.isFinite(parsed.port) ? parsed.port : DEFAULT_CONFIG.port,
      autoStart: parsed.autoStart ?? DEFAULT_CONFIG.autoStart,
      providerChoice: parseProviderChoice(parsed.providerChoice),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function statusTone(phase: ContainerPhase): 'success' | 'warning' | 'error' | 'default' {
  switch (phase) {
    case 'running':
      return 'success';
    case 'starting':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

export function App() {
  const ddClient = useMemo(() => getDDClient(), []);
  const demoMode = useMemo(() => isDemoMode(), []);
  const [config, setConfig] = useState<ExtensionConfig>(loadConfig);
  const [phase, setPhase] = useState<ContainerPhase>('missing');
  const [statusText, setStatusText] = useState('No OpenClaw container yet');
  // The image the existing service container was created from, as reported by
  // Docker. When it differs from RUNTIME_IMAGE the service is recreated.
  const [runningImage, setRunningImage] = useState('');
  const [token, setToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>('unknown');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState('');
  const diagLogText = useDiagLogText();
  const [requirementsChecking, setRequirementsChecking] = useState(false);
  const [requirementsStatus, setRequirementsStatus] = useState('');
  const [requirementsSeverity, setRequirementsSeverity] = useState<AlertColor>('info');
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('');
  const [configuredOllamaModel, setConfiguredOllamaModel] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('');
  const [ollamaAlertSeverity, setOllamaAlertSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');
  const [ollamaBannerDismissed, setOllamaBannerDismissed] = useState(
    () => window.localStorage.getItem(OLLAMA_BANNER_DISMISS_KEY) === 'true',
  );
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(DEFAULT_EXECUTION_MODE);
  const [appliedExecutionMode, setAppliedExecutionMode] = useState<ExecutionMode>(DEFAULT_EXECUTION_MODE);
  const [executionModeChecking, setExecutionModeChecking] = useState(false);
  const [executionModeStatus, setExecutionModeStatus] = useState('');
  const [executionModeAlertSeverity, setExecutionModeAlertSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');
  const selectedOllamaChanged = Boolean(selectedOllamaModel) && selectedOllamaModel !== configuredOllamaModel;
  const executionModeChanged = executionMode !== appliedExecutionMode;

  const persistConfig = useCallback((next: ExtensionConfig) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConfig(next);
  }, []);

  const openUrl = useMemo(() => `http://127.0.0.1:${config.port}`, [config.port]);
  const wsUrl = useMemo(() => `ws://127.0.0.1:${config.port}`, [config.port]);
  const recommendedOllamaModel = useMemo(
    () => chooseRecommendedOllamaModel(ollamaModels),
    [ollamaModels],
  );
  const demoOnboardingPhase = useMemo(
    () => (demoMode ? parseDemoOnboardingPhase(window.location.search) : null),
    [demoMode],
  );
  const onboardingPhase =
    demoOnboardingPhase ??
    deriveOnboardingPhase({
      providerChoice: config.providerChoice,
      configuredOllamaModel,
      ollamaModels,
    });
  const chatGated = isChatGated(config.providerChoice, configuredOllamaModel);
  const chatGateWarning = chatGateMessage(config.providerChoice, configuredOllamaModel);
  const onboardingPullCommand = formatOllamaPullCommand(DEFAULT_OLLAMA_ONBOARDING_MODEL);
  const setProviderChoice = useCallback((providerChoice: ProviderChoice) => {
    const next = { ...config, providerChoice };
    persistConfig(next);
  }, [config, persistConfig]);

  const asText = useCallback((value: unknown) => {
    return typeof value === 'string' ? value : '';
  }, []);

  const findContainer = useCallback(async (): Promise<ContainerSnapshot | null> => {
    const containers = (await ddClient.docker.listContainers({
      all: true,
      filters: {
        label: Object.entries(LABELS).map(([key, value]) => `${key}=${value}`),
      },
    })) as Array<{
      Id: string;
      State: string;
      Status: string;
      Image?: string;
      Names?: string[];
      Name?: string;
    }>;

    if (containers.length > 0) {
      const container = containers[0];
      return {
        id: container.Id,
        state: container.State,
        status: container.Status,
        image: container.Image,
      };
    }

    const byName = (await ddClient.docker.listContainers({
      all: true,
      filters: { name: [CONTAINER_NAME] },
    })) as Array<{ Id: string; State: string; Status: string; Image?: string }>;

    if (byName.length === 0) {
      return null;
    }

    return {
      id: byName[0].Id,
      state: byName[0].State,
      status: byName[0].Status,
      image: byName[0].Image,
    };
  }, [ddClient]);

  const appendDebug = useCallback((entry: string) => {
    setDebugLog((current) => {
      return appendDebugEntry(current, entry);
    });
  }, []);

  const findPortConflicts = useCallback(async () => {
    const result = (await ddClient.docker.cli.exec('ps', buildDockerPsPortCheckArgs())) as CliExecResult;
    return parseDockerPublishedPortConflicts(asText(result.stdout), config.port, CONTAINER_NAME);
  }, [asText, config.port, ddClient]);

  const currentOllamaState = useCallback(() => ({
    phase,
    busy,
    ollamaChecking,
    ollamaStatus,
    ollamaAlertSeverity,
    selectedOllamaModel,
    configuredOllamaModel,
    models: ollamaModels,
    actionSeq: 0,
    appliedSeq: 0,
  }), [
    busy,
    configuredOllamaModel,
    ollamaAlertSeverity,
    ollamaChecking,
    ollamaModels,
    ollamaStatus,
    phase,
    selectedOllamaModel,
  ]);

  const copyDiagnostics = useCallback(async () => {
    setError('');
    let health: string | undefined;
    try {
      const container = await findContainer();
      health = container?.status;
    } catch {
      health = undefined;
    }

    const bundle = buildDiagnosticsBundle(
      {
        extensionVersion: 'unknown',
        runtimeImage: RUNTIME_IMAGE,
        dockerDesktop: 'unknown',
        os: navigator.platform,
      },
      readDiagEvents(),
      captureOllamaSnapshot(currentOllamaState()),
      health,
    );

    try {
      await navigator.clipboard.writeText(bundle);
      setMessage('Diagnostics copied to clipboard.');
    } catch {
      setError('Could not copy diagnostics to clipboard.');
    }
  }, [currentOllamaState, findContainer]);

  const checkRequirements = useCallback(async (modelOverride?: string) => {
    // modelOverride lets callers (e.g. applyOllamaSetup) refresh the banner with a
    // model that was just written but not yet reflected in configuredOllamaModel
    // state, since this callback closes over the previous state value.
    const effectiveOllamaModel = modelOverride ?? configuredOllamaModel;
    setRequirementsChecking(true);
    setRequirementsStatus('');
    setRequirementsSeverity('info');
    setError('');
    try {
      await traceAction('requirements.check', async ({ step }) => {
        const version = (await ddClient.docker.cli.exec('version', ['--format', '{{.Server.Version}}'])) as CliExecResult;
        const dockerVersion = asText(version.stdout).trim();
        if (!dockerVersion) {
          step('docker_version', 'error');
          throw new Error('Docker Desktop responded, but the Docker Engine version was empty.');
        }
        step('docker_version', 'ok', { attrs: { dockerVersion } });

        const conflicts = await findPortConflicts();
        if (conflicts.length > 0) {
          step('port_check', 'warning', { attrs: { hostPort: config.port } });
          setRequirementsSeverity('warning');
          setRequirementsStatus(
            `Docker is ready, but host port ${config.port} is already published by ${conflicts.map((conflict) => conflict.name || conflict.id).join(', ')}. Change the Host Port or stop the other container before starting OpenClaw.`,
          );
          return;
        }
        step('port_check', 'ok', { attrs: { hostPort: config.port } });

        if (phase === 'running') {
          const container = await findContainer();
          if (container?.state === 'running') {
            try {
              await ddClient.docker.cli.exec('exec', [container.id, ...buildOllamaTagsFetchArgs()]);
              const ollamaStatus = formatOllamaRequirementStatus({
                hostPort: config.port,
                configuredOllamaModel: effectiveOllamaModel,
                ollamaReachable: true,
              });
              step('ollama_check', 'ok');
              setRequirementsSeverity(ollamaStatus.severity);
              setRequirementsStatus(ollamaStatus.status);
              return;
            } catch (err) {
              const text = formatUnknownError(err);
              const ollamaStatus = formatOllamaRequirementStatus({
                hostPort: config.port,
                configuredOllamaModel: effectiveOllamaModel,
                ollamaReachable: false,
              });
              step('ollama_check', 'warning', { error: { message: text } });
              setRequirementsSeverity(ollamaStatus.severity);
              setRequirementsStatus(ollamaStatus.status);
              return;
            }
          }
        }

        step('complete', 'ok');
        setRequirementsSeverity('success');
        setRequirementsStatus(
          `Docker is ready and host port ${config.port} is available. Ollama is only required for Local Model Setup or an ollama/<model> default.`,
        );
      });
    } catch (err) {
      const text = formatUnknownError(err);
      setRequirementsSeverity('error');
      setRequirementsStatus(formatStartFailure(text, config.port));
    } finally {
      setRequirementsChecking(false);
    }
  }, [asText, config.port, configuredOllamaModel, ddClient, findContainer, findPortConflicts, phase]);

  const fetchGatewayToken = useCallback(async (containerId: string) => {
    const result = (await ddClient.docker.cli.exec('exec', [
      containerId,
      ...buildRuntimeHelperArgs('gateway-token'),
    ])) as CliExecResult;
    return asText(result.stdout).trim();
  }, [asText, ddClient]);

  const readToken = useCallback(async (containerId: string) => {
    setTokenStatus('checking');
    try {
      const nextToken = await readGatewayTokenWithRetry(
        () => fetchGatewayToken(containerId),
        { attempts: 5, delayMs: 1000 },
      );
      setToken(nextToken);
      setTokenStatus(nextToken ? 'ready' : 'empty');
      return nextToken;
    } catch (err) {
      appendDebug(`token read failed: ${formatUnknownError(err)}`);
      setToken('');
      setTokenStatus('error');
      return '';
    }
  }, [appendDebug, fetchGatewayToken]);

  const refreshToken = useCallback(async () => {
    setError('');
    setMessage('');
    try {
      const container = await findContainer();
      if (!container || container.state !== 'running') {
        setToken('');
        setTokenStatus('error');
        setError('Start OpenClaw before refreshing the gateway token.');
        return '';
      }

      const nextToken = await readToken(container.id);
      setMessage(
        nextToken
          ? 'Gateway token refreshed.'
          : 'Gateway token is still blank. Restart OpenClaw if Refresh Token does not recover it.',
      );
      return nextToken;
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`token refresh failed: ${text}`);
      setToken('');
      setTokenStatus('error');
      setError(`Could not refresh gateway token: ${text}`);
      return '';
    }
  }, [appendDebug, findContainer, readToken]);

  const checkReady = useCallback(async () => {
    if (demoMode) {
      return true;
    }

    try {
      const response = await fetch(`${openUrl}/healthz`, { cache: 'no-store' });
      if (!response.ok) {
        return false;
      }

      const text = await response.text();
      return text.includes('"ok":true');
    } catch {
      return false;
    }
  }, [demoMode, openUrl]);

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    try {
      const container = await findContainer();
      if (!container) {
        setPhase('missing');
        setStatusText('No OpenClaw container yet');
        setToken('');
        setTokenStatus('unknown');
        setRunningImage('');
        return { phase: 'missing', ready: false };
      }

      setRunningImage(container.image ?? '');

      if (container.state === 'running') {
        const ready = await checkReady();
        setPhase(ready ? 'running' : 'starting');
        setStatusText(ready ? 'OpenClaw is ready' : container.status);
        await readToken(container.id);
        return { phase: ready ? 'running' : 'starting', ready };
      }

      setPhase(container.state === 'exited' ? 'stopped' : 'error');
      setStatusText(container.status);
      setToken('');
      setTokenStatus('unknown');
      return { phase: container.state === 'exited' ? 'stopped' : 'error', ready: false };
    } catch (err) {
      setPhase('error');
      setStatusText('Failed to inspect container');
      setError(formatUnknownError(err));
      return { phase: 'error', ready: false };
    }
  }, [checkReady, findContainer, readToken]);

  const runAndPoll = useCallback(async (step?: StepFn) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      step?.('poll_attempt', 'ok', { attrs: { attempt: attempt + 1 } });
      const result = await refresh();
      if (result.ready) {
        step?.('health_check', 'ok');
        break;
      }
      if (attempt < 19) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
    }
  }, [refresh]);

  const createOrStart = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    setPhase('starting');
    setStatusText('Creating OpenClaw container...');
    try {
      await traceAction('container.start', async ({ step }) => {
        let existing = await findContainer();
        // A service created from any other image (an older extension release,
        // or a local build since replaced) is recreated from the pinned image.
        // The named volume is kept, and the runtime's doctor-on-start applies
        // OpenClaw's own migrations before the gateway starts.
        if (existing && needsRuntimeRecreate(existing.image, RUNTIME_IMAGE)) {
          step('runtime_mismatch', 'ok', { attrs: { running: existing.image ?? '', pinned: RUNTIME_IMAGE } });
          appendDebug(`recreating OpenClaw service: created from ${existing.image}, this extension runs ${RUNTIME_IMAGE}`);
          setStatusText('Updating OpenClaw to the version bundled with this extension...');
          await ddClient.docker.cli.exec('stop', buildServiceStopArgs(existing.id));
          await ddClient.docker.cli.exec('rm', [existing.id]);
          existing = null;
        }
        if (existing) {
          step('find_existing', 'ok', { attrs: { state: existing.state } });
          await ddClient.docker.cli.exec('start', [existing.id]);
          step('docker_start', 'ok');
          setStatusText('Starting existing OpenClaw container...');
        } else {
          const conflicts = await findPortConflicts();
          if (conflicts.length > 0) {
            step('port_check', 'error', { code: 'START-001', attrs: { hostPort: config.port } });
            throw new Error(
              `Host port ${config.port} is already published by ${conflicts.map((conflict) => conflict.name || conflict.id).join(', ')}. Change the Host Port in Settings or stop the other container, then try Start again.`,
            );
          }

          step('docker_run', 'ok', { attrs: { image: RUNTIME_IMAGE } });
          const result = (await ddClient.docker.cli.exec('run', buildRuntimeRunArgs({
            containerName: CONTAINER_NAME,
            image: RUNTIME_IMAGE,
            volumeName: VOLUME_NAME,
            hostPort: config.port,
            bridgePort: BRIDGE_PORT,
            labels: LABELS,
          }))) as CliExecResult;
          const stdout = asText(result.stdout).trim();
          const stderr = asText(result.stderr).trim();

          await new Promise((resolve) => window.setTimeout(resolve, 1500));
          const created = await findContainer();
          if (!created) {
            step('verify_created', 'error', { error: { message: stderr || stdout || 'container missing' } });
            throw new Error(
              stderr ||
                stdout ||
                'Docker reported success, but no OpenClaw service container was created.',
            );
          }
          step('verify_created', 'ok');
        }

        setMessage('OpenClaw setup started. The first launch can take a minute while socat is installed.');
        await runAndPoll(step);
      });
    } catch (err) {
      setPhase('error');
      const text = formatStartFailure(formatUnknownError(err), config.port);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, asText, config.port, ddClient, findContainer, findPortConflicts, runAndPoll]);

  const stop = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const container = await findContainer();
      if (container) {
        await ddClient.docker.cli.exec('stop', [container.id]);
      }
      await refresh();
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`stop failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, ddClient, findContainer, refresh]);

  // Best-effort: preload an Ollama model into memory so the user's first
  // message after a (re)start doesn't pay the cold-load cost (which otherwise
  // surfaces as "LLM request timed out"). Fire-and-forget — it never blocks or
  // fails the calling flow, and is a no-op for a blank model.
  const warmUpOllamaModel = useCallback(
    (containerId: string, model: string) => {
      const args = buildOllamaWarmupArgs(model);
      if (args.length === 0) {
        return;
      }
      void ddClient.docker.cli
        .exec('exec', [containerId, ...args])
        .then(() => appendDebug(`warmed up Ollama model ${model.trim()}`))
        .catch((err) => appendDebug(`ollama warmup skipped: ${formatUnknownError(err)}`));
    },
    [appendDebug, ddClient],
  );

  const restart = useCallback(
    async (warmupModel?: string) => {
      setBusy(true);
      setError('');
      try {
        await traceAction('container.restart', async ({ step }) => {
          const container = await findContainer();
          if (container) {
            await ddClient.docker.cli.exec('restart', [container.id]);
            step('docker_restart', 'ok');
            await runAndPoll(step);
            const modelToWarm =
              warmupModel ?? (config.providerChoice === 'ollama' ? configuredOllamaModel : '');
            warmUpOllamaModel(container.id, modelToWarm);
          } else {
            step('container_missing', 'warning');
            await createOrStart();
          }
        });
      } catch (err) {
        const text = formatUnknownError(err);
        setError(text);
      } finally {
        setBusy(false);
      }
    },
    [config.providerChoice, configuredOllamaModel, createOrStart, ddClient, findContainer, runAndPoll, warmUpOllamaModel],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const container = await findContainer();
      if (container) {
        await ddClient.docker.cli.exec('stop', buildServiceStopArgs(container.id));
        await ddClient.docker.cli.exec('rm', [container.id]);
      }
      setToken('');
      setTokenStatus('unknown');
      await refresh();
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`remove failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, ddClient, findContainer, refresh]);

  const openBrowser = useCallback(async () => {
    const ready = await checkReady();
    if (!ready) {
      setError('OpenClaw Control is not reachable on localhost yet. Start or restart OpenClaw and try again.');
      return;
    }

    let launchToken = token;
    try {
      const container = await findContainer();
      if (container?.state === 'running') {
        launchToken = await readGatewayTokenWithRetry(
          () => fetchGatewayToken(container.id),
          { attempts: 5, delayMs: 1000 },
        );
        setToken(launchToken);
        setTokenStatus(launchToken ? 'ready' : 'empty');
      }
    } catch (err) {
      appendDebug(`launch token refresh failed: ${formatUnknownError(err)}`);
      launchToken = '';
      setTokenStatus('error');
    }

    await Promise.resolve(ddClient.host.openExternal(buildControlUiLaunchUrl(openUrl, launchToken)));
    setMessage(
      launchToken
        ? 'Opened OpenClaw Control with gateway token bootstrap.'
        : 'Opened OpenClaw Control without a token. Click Refresh Token, then Open Control UI again if the dashboard asks.',
    );
  }, [appendDebug, checkReady, ddClient, fetchGatewayToken, findContainer, openUrl, token]);

  const copyToken = useCallback(async () => {
    if (!token) {
      return;
    }
    await navigator.clipboard.writeText(token);
    setMessage('Gateway token copied to clipboard.');
  }, [token]);

  const detectOllamaModels = useCallback(async () => {
    setOllamaChecking(true);
    setError('');
    setOllamaStatus('');
    setOllamaAlertSeverity('info');
    try {
      const container = await findContainer();
      if (!container || container.state !== 'running') {
        throw new Error('Start OpenClaw before detecting local Ollama models.');
      }

      const output = await runDetect({
        run: async (cmd, args) => (await ddClient.docker.cli.exec(cmd, args)) as CliExecResult,
        containerId: container.id,
        selectedOllamaModel,
        phase,
      });

      setOllamaModels(output.models);
      setConfiguredOllamaModel(output.configuredOllamaModel);
      setSelectedOllamaModel(output.selectedOllamaModel);
      setOllamaAlertSeverity(output.severity);
      setOllamaStatus(output.status);
    } catch (err) {
      const text = formatUnknownError(err);
      setOllamaModels([]);
      setConfiguredOllamaModel('');
      setSelectedOllamaModel('');
      setOllamaAlertSeverity('error');
      setOllamaStatus(`Could not reach host Ollama from OpenClaw: ${text}`);
    } finally {
      setOllamaChecking(false);
    }
  }, [ddClient, findContainer, phase, selectedOllamaModel]);

  const detectExecutionMode = useCallback(async () => {
    setExecutionModeChecking(true);
    setError('');
    setExecutionModeStatus('');
    setExecutionModeAlertSeverity('info');
    try {
      const container = await findContainer();
      if (!container || container.state !== 'running') {
        throw new Error('Start OpenClaw before checking execution mode.');
      }

      const result = (await ddClient.docker.cli.exec('exec', [
        container.id,
        ...buildRuntimeHelperArgs('exec-mode-read'),
      ])) as CliExecResult;
      const stderr = asText(result.stderr).trim();
      if (stderr) {
        appendDebug(`execution mode detect stderr: ${stderr}`);
      }

      const detected = parseExecModeReadOutput(asText(result.stdout));
      if (!detected) {
        throw new Error("OpenClaw did not report its execution policy.");
      }
      setExecutionMode(detected);
      setAppliedExecutionMode(detected);
      setExecutionModeAlertSeverity('success');
      setExecutionModeStatus(
        detected === 'full'
          ? 'Full access is currently applied (OpenClaw\'s default). Commands run without approval prompts inside the OpenClaw container.'
          : 'Safer mode is currently applied. Unknown commands require allowlist matching or approval.',
      );
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`execution mode detect failed: ${text}`);
      setExecutionModeAlertSeverity('error');
      setExecutionModeStatus(`Could not read execution mode: ${text}`);
    } finally {
      setExecutionModeChecking(false);
    }
  }, [appendDebug, asText, ddClient, findContainer]);

  const applyExecutionMode = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    setExecutionModeStatus('');
    setExecutionModeAlertSeverity(executionMode === 'full' ? 'warning' : 'info');
    try {
      const container = await findContainer();
      if (!container || container.state !== 'running') {
        throw new Error('Start OpenClaw before applying execution mode.');
      }

      appendDebug(`applying OpenClaw execution mode: ${executionMode}`);
      await ddClient.docker.cli.exec('exec', [
        container.id,
        ...buildRuntimeHelperArgs('exec-mode-write', [executionMode]),
      ]);
      setExecutionModeStatus(
        `Applied ${executionMode === 'full' ? 'Full access' : 'Safer'} mode. Restarting OpenClaw...`,
      );
      await restart();
      setAppliedExecutionMode(executionMode);
      setExecutionModeAlertSeverity(executionMode === 'full' ? 'warning' : 'success');
      setExecutionModeStatus(
        executionMode === 'full'
          ? 'Restart complete. Full access is active; command approval protections are reduced.'
          : 'Restart complete. Safer mode is active.',
      );
      setMessage(`OpenClaw execution mode applied: ${executionMode === 'full' ? 'Full access' : 'Safer'}.`);
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`execution mode apply failed: ${text}`);
      setExecutionModeAlertSeverity('error');
      setExecutionModeStatus(`Could not apply execution mode: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, ddClient, executionMode, findContainer, restart]);

  const applyOllamaSetup = useCallback(async (modelOverride?: string) => {
    const model = (modelOverride ?? selectedOllamaModel).trim();
    if (!model) {
      setOllamaStatus('Choose an installed Ollama model first.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const container = await findContainer();
      if (!container || container.state !== 'running') {
        throw new Error('Start OpenClaw before applying local model setup.');
      }

      appendDebug(`configuring OpenClaw Ollama provider for ${model}`);
      await ddClient.docker.cli.exec('exec', [
        container.id,
        ...buildRuntimeHelperArgs('ollama-config-write', [model]),
      ]);
      await ddClient.docker.cli.exec('exec', [
        container.id,
        ...buildRuntimeHelperArgs('ollama-auth-write'),
      ]);
      // ollama-config-write sets openclaw.json's auth.profiles/order entry for
      // `ollama:manual`; ollama-auth-write registers the key for every agent
      // through `openclaw models auth paste-api-key`, which owns OpenClaw's
      // SQLite auth store. Writing auth-profiles.json directly produced a
      // legacy file OpenClaw 2026.9.3 refuses to run with (#242).
      appendDebug(`OpenClaw default model set to ollama/${model}`);
      setOllamaStatus(`Configured OpenClaw to use Ollama model ${model}. Restarting OpenClaw...`);
      await restart(model);
      setConfiguredOllamaModel(model);
      persistConfig({ ...config, providerChoice: 'ollama' });
      setOllamaStatus(`Restart complete. OpenClaw is using ${model}.`);
      setMessage(`OpenClaw local model setup applied for ${model}.`);
      // Refresh the requirements banner so it reflects the newly applied model.
      // Pass the model explicitly because setConfiguredOllamaModel above has not
      // yet propagated to checkRequirements' captured state.
      await checkRequirements(model);
    } catch (err) {
      const text = formatUnknownError(err);
      appendDebug(`ollama setup failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, checkRequirements, config, ddClient, findContainer, persistConfig, restart, selectedOllamaModel]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (config.autoStart && phase === 'missing' && !busy) {
      void createOrStart();
    }
  }, [busy, config.autoStart, createOrStart, phase]);

  // Opening a newly installed extension over a service that is still running
  // the previous release's image moves it onto this release's image once per
  // session. A stopped service is left alone until the user clicks Start, which
  // performs the same recreate.
  const runtimeRecreateAttempted = useRef(false);
  useEffect(() => {
    if (busy || runtimeRecreateAttempted.current || phase !== 'running') {
      return;
    }
    if (!needsRuntimeRecreate(runningImage, RUNTIME_IMAGE)) {
      return;
    }
    runtimeRecreateAttempted.current = true;
    void createOrStart();
  }, [busy, createOrStart, phase, runningImage]);

  useEffect(() => {
    if (phase === 'running') {
      void detectExecutionMode();
      void detectOllamaModels();
    }
  }, [phase, detectExecutionMode, detectOllamaModels]);

  const tokenHelperText = getGatewayTokenHelperText(token, tokenStatus);

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" gutterBottom>
            OpenClaw Extension
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Start OpenClaw from Docker Desktop using a macOS-safe socat bridge that makes the
            Control UI reachable on localhost.
          </Typography>
        </Box>

        {phase === 'missing' && !busy && onboardingPhase === 'resolved' && (
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h5">Quick Start</Typography>
                <Typography variant="body2" color="text.secondary">
                  1. Click <strong>Start</strong> below to create the OpenClaw container
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  2. Wait for the gateway token to appear in the Connection card
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3. Click <strong>Open Control UI</strong> to launch OpenClaw (token is auto-attached)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  4. Enable a local model in <strong>Local Model Setup</strong> below
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        {onboardingPhase !== 'resolved' && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h5">Choose how OpenClaw should chat</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pick a local Ollama model or use a hosted Anthropic key before starting a first chat.
                  </Typography>
                </Box>

                {onboardingPhase === 'fork' && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">Free local (Ollama)</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use an installed host Ollama model through the local runtime bridge.
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={() => {
                            setProviderChoice('ollama');
                            if (phase === 'running') {
                              void detectOllamaModels();
                            }
                          }}
                          disabled={busy || ollamaChecking}
                        >
                          Use Free Local
                        </Button>
                      </Stack>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1">Hosted (Anthropic API key)</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Continue with the hosted provider path and configure the Anthropic key through
                          OpenClaw's existing provider or .env flow.
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setProviderChoice('anthropic');
                            setMessage('Hosted provider selected. Configure your Anthropic key in OpenClaw before chatting.');
                          }}
                          disabled={busy}
                        >
                          Use Hosted
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                )}

                {onboardingPhase === 'free-ready' && (
                  <Alert
                    severity="info"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => {
                          if (recommendedOllamaModel) {
                            setSelectedOllamaModel(recommendedOllamaModel);
                          }
                          void applyOllamaSetup(recommendedOllamaModel);
                        }}
                        disabled={busy || !recommendedOllamaModel}
                      >
                        {ollamaOnboardingActionLabel(recommendedOllamaModel, configuredOllamaModel)}
                      </Button>
                    }
                  >
                    Host Ollama has {ollamaModels.length} model{ollamaModels.length === 1 ? '' : 's'}.
                    Use {recommendedOllamaModel} as the OpenClaw default.
                  </Alert>
                )}

                {onboardingPhase === 'free-needs-model' && (
                  <Stack spacing={1}>
                    <Alert
                      severity="warning"
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          startIcon={ollamaChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
                          onClick={() => void detectOllamaModels()}
                          disabled={busy || ollamaChecking || phase !== 'running'}
                        >
                          {ollamaChecking ? 'Checking...' : 'Re-detect'}
                        </Button>
                      }
                    >
                      Install and start Ollama, then pull a model. Start OpenClaw and re-detect models when it is ready.
                    </Alert>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label="Terminal command"
                        value={onboardingPullCommand}
                        fullWidth
                        InputProps={{ readOnly: true }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => {
                          void navigator.clipboard.writeText(onboardingPullCommand);
                          setMessage('Ollama pull command copied.');
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() => void ddClient.host.openExternal('https://ollama.com/download')}
                      >
                        Ollama
                      </Button>
                    </Stack>
                  </Stack>
                )}

                {(config.providerChoice === 'ollama' || onboardingPhase === 'free-ready') && (
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        setProviderChoice('anthropic');
                        setMessage('Hosted provider selected. Configure your Anthropic key in OpenClaw before chatting.');
                      }}
                      disabled={busy}
                    >
                      {onboardingPhase === 'free-ready' ? 'Use hosted instead' : 'I configured hosted access elsewhere'}
                    </Button>
                    {config.providerChoice === 'ollama' && (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => setProviderChoice('unset')}
                        disabled={busy}
                      >
                        Choose again
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {phase === 'running' && ollamaModels.length > 0 && !configuredOllamaModel && !ollamaBannerDismissed && (
          <Alert
            severity="info"
            onClose={() => {
              window.localStorage.setItem(OLLAMA_BANNER_DISMISS_KEY, 'true');
              setOllamaBannerDismissed(true);
            }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  const recommended = chooseRecommendedOllamaModel(ollamaModels);
                  if (recommended) {
                    setSelectedOllamaModel(recommended);
                    setMessage(`Recommended model ${recommended} selected. Click Apply and Restart to activate.`);
                  }
                }}
                disabled={busy}
              >
                Select Recommended Model
              </Button>
            }
          >
            Host Ollama detected {ollamaModels.length} model{ollamaModels.length === 1 ? '' : 's'}.
            No local model configured yet. Select a model in Local Model Setup below and click Apply and Restart.
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        {phase === 'running' && chatGated && (
          <Alert severity="warning">{chatGateWarning}</Alert>
        )}

        {requirementsStatus && (
          <Alert severity={requirementsSeverity} onClose={() => setRequirementsStatus('')}>
            {requirementsStatus}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="h5">Status</Typography>
                <Chip color={statusTone(phase)} label={phase.toUpperCase()} />
                {busy && <CircularProgress size={20} />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {statusText}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  startIcon={busy ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  onClick={() => void createOrStart()}
                  disabled={busy || phase === 'running'}
                >
                  {busy ? 'Starting...' : 'Start'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={requirementsChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
                  onClick={() => void checkRequirements()}
                  disabled={busy || requirementsChecking}
                >
                  {requirementsChecking ? 'Checking...' : 'Check Requirements'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => void restart()}
                  disabled={busy}
                >
                  Restart
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<StopIcon />}
                  onClick={() => void stop()}
                  disabled={busy}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Remove Container
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<LaunchIcon />}
                  onClick={() => void openBrowser()}
                  disabled={busy || phase !== 'running' || chatGated}
                >
                  Open Control UI
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Connection</Typography>
              <TextField label="Browser URL" value={openUrl} fullWidth InputProps={{ readOnly: true }} />
              <TextField label="WebSocket URL" value={wsUrl} fullWidth InputProps={{ readOnly: true }} />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Gateway Token"
                  value={token}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  helperText={tokenHelperText}
                  sx={token ? { '& .MuiInputBase-root': { borderColor: 'success.main' } } : undefined}
                />
                {token && <Chip label="Auto-attached" color="success" size="small" sx={{ mt: 2 }} />}
                <Button
                  variant="outlined"
                  startIcon={tokenStatus === 'checking' ? <CircularProgress size={20} /> : <RefreshIcon />}
                  onClick={() => void refreshToken()}
                  disabled={busy || tokenStatus === 'checking' || phase !== 'running'}
                >
                  Refresh Token
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => void copyToken()}
                  disabled={!token}
                >
                  Copy
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Settings</Typography>
              <TextField
                label="OpenClaw Runtime"
                value={needsRuntimeRecreate(runningImage, RUNTIME_IMAGE) ? `${runningImage} (updating to ${RUNTIME_IMAGE})` : RUNTIME_IMAGE}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Bundled with this extension release. Installing a newer extension updates OpenClaw; your data volume is kept."
              />
              <TextField
                label="Host Port"
                type="number"
                value={config.port}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    port: Number(event.target.value) || DEFAULT_CONFIG.port,
                  }))
                }
                helperText="The extension publishes this port on localhost and bridges it to OpenClaw internally."
              />
              <Button
                variant="outlined"
                onClick={() => {
                  persistConfig(config);
                  setMessage('Settings saved. Restart the container to apply changes.');
                }}
              >
                Save Settings
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Local Model Setup</Typography>
              <Typography variant="body2" color="text.secondary">
                Use an already installed host Ollama model. The extension verifies Ollama from inside
                the OpenClaw container and writes only the OpenClaw provider config in the named volume.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                On a laptop, the first reply in a new chat can take about 1–2 minutes while the model
                reads its instructions. Later replies in the same chat are much faster.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={ollamaChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
                  onClick={() => void detectOllamaModels()}
                  disabled={busy || ollamaChecking || phase !== 'running'}
                >
                  {ollamaChecking ? 'Checking...' : 'Detect Ollama Models'}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void applyOllamaSetup()}
                  disabled={busy || phase !== 'running' || !selectedOllamaChanged}
                >
                  {ollamaApplyButtonLabel(selectedOllamaModel, selectedOllamaChanged)}
                </Button>
              </Stack>
              <TextField
                select
                SelectProps={{ native: true }}
                label="Ollama Model"
                value={selectedOllamaModel}
                onChange={(event) => setSelectedOllamaModel(event.target.value)}
                fullWidth
                helperText={
                  configuredOllamaModel
                    ? `Configured model: ${configuredOllamaModel}`
                    : 'Models are read from host Ollama through host.docker.internal:11434.'
                }
                disabled={ollamaModels.length === 0}
              >
                {ollamaModels.length === 0 && <option value="">No models detected yet</option>}
                {ollamaModels.map((model) => {
                  const size = formatOllamaModelSize(model.size);
                  return (
                    <option key={model.name} value={model.name}>
                      {size ? `${model.name} — ${size}` : model.name}
                    </option>
                  );
                })}
              </TextField>
              {ollamaStatus && (
                <Alert severity={ollamaAlertSeverity}>{ollamaStatus}</Alert>
              )}
              {configuredOllamaModel && (
                <Alert severity="info" icon={false}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Performance Tip
                  </Typography>
                  <Typography variant="body2">
                    {getCondensedGuidance()}
                  </Typography>
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Execution Mode</Typography>
              <Typography variant="body2" color="text.secondary">
                OpenClaw may cache exec approval policy until the gateway restarts. Changing this mode applies
                OpenClaw&apos;s built-in exec policy preset, then restarts OpenClaw automatically.
              </Typography>
              <RadioGroup
                value={executionMode}
                onChange={(event) => setExecutionMode(event.target.value as ExecutionMode)}
              >
                <FormControlLabel
                  value="safer"
                  control={<Radio />}
                  label="Safer: allowlisted commands and approval prompts"
                />
                <FormControlLabel
                  value="full"
                  control={<Radio />}
                  label="Full access: run commands without approval prompts"
                />
              </RadioGroup>
              {executionMode === 'full' && (
                <Alert severity="warning">
                  Full access reduces command approval protections. Use it only when you trust the local
                  OpenClaw session and understand commands can run inside the service container without prompts.
                </Alert>
              )}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={executionModeChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
                  onClick={() => void detectExecutionMode()}
                  disabled={busy || executionModeChecking || phase !== 'running'}
                >
                  {executionModeChecking ? 'Checking...' : 'Check Mode'}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void applyExecutionMode()}
                  disabled={busy || phase !== 'running' || !executionModeChanged}
                >
                  {executionModeChanged ? 'Apply and Restart' : 'Already Applied'}
                </Button>
              </Stack>
              {executionModeStatus && (
                <Alert severity={executionModeAlertSeverity}>{executionModeStatus}</Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h5">How It Works</Typography>
              <Typography variant="body2" color="text.secondary">
                OpenClaw listens on container loopback by default. On macOS, Docker Desktop does not
                always forward that listener correctly. This extension uses a local runtime image with
                a baked-in socat bridge so Docker Desktop can publish a normal host-facing port.
              </Typography>
              <Divider />
              <Typography variant="body2" color="text.secondary">
                Named volume: {VOLUME_NAME}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Service container: {CONTAINER_NAME}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="h5">Debug Output</Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void copyDiagnostics()}
                  >
                    Copy Diagnostics
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setDebugLog('');
                      resetDiagEvents();
                    }}
                    disabled={!debugLog && !diagLogText}
                  >
                    Clear Debug
                  </Button>
                </Stack>
              </Stack>
              <TextField
                value={diagLogText}
                multiline
                minRows={8}
                fullWidth
                InputProps={{ readOnly: true }}
                placeholder="Runtime diagnostics from the extension will appear here."
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
