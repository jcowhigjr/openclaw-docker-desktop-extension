import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDDClient } from './dockerDesktopClient';

type ContainerPhase = 'missing' | 'running' | 'stopped' | 'starting' | 'error';

type ExtensionConfig = {
  image: string;
  port: number;
  autoStart: boolean;
};

type ContainerSnapshot = {
  id: string;
  state: string;
  status: string;
};

type CliExecResult = {
  stdout?: string;
  stderr?: string;
};

type RefreshResult = {
  phase: ContainerPhase;
  ready: boolean;
};

type DemoState = {
  config: ExtensionConfig;
  phase: ContainerPhase;
  statusText: string;
  token: string;
  message: string;
  debugLog: string;
};

const STORAGE_KEY = 'openclaw-docker-extension-config';
const CONTAINER_NAME = 'openclaw-docker-extension-service';
const VOLUME_NAME = 'openclaw-docker-extension-home';
const BRIDGE_PORT = 18790;
const RUNTIME_PLATFORM = 'linux/arm64';
const SUPPORTED_DOCKER_ARCH = 'arm64';
const LEGACY_RUNTIME_IMAGE = 'ghcr.io/openclaw/openclaw:latest';
const DEFAULT_RUNTIME_IMAGE = import.meta.env.VITE_DEFAULT_RUNTIME_IMAGE || 'openclaw-docker-extension-runtime:dev';
const DEFAULT_CONFIG: ExtensionConfig = {
  image: DEFAULT_RUNTIME_IMAGE,
  port: 18789,
  autoStart: true,
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

    const parsed = JSON.parse(raw) as Partial<ExtensionConfig>;
    const image = typeof parsed.image === 'string' ? parsed.image.trim() : '';
    return {
      image: image ? (image === LEGACY_RUNTIME_IMAGE ? DEFAULT_RUNTIME_IMAGE : image) : DEFAULT_CONFIG.image,
      port: typeof parsed.port === 'number' && Number.isFinite(parsed.port) ? parsed.port : DEFAULT_CONFIG.port,
      autoStart: parsed.autoStart ?? DEFAULT_CONFIG.autoStart,
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

function loadDemoState(): DemoState | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') !== '1') {
    return null;
  }

  return {
    config: {
      image: DEFAULT_RUNTIME_IMAGE,
      port: 18789,
      autoStart: false,
    },
    phase: 'running',
    statusText: 'OpenClaw is ready',
    token: 'oc_demo_18789_localhost',
    message: '',
    debugLog: [
      'demo mode enabled',
      'container state: running',
      'healthz check: ok',
      'token loaded from /home/node/.openclaw/openclaw.json',
    ].join('\n'),
  };
}

export function App() {
  const demoState = useMemo(() => loadDemoState(), []);
  const isDemo = demoState !== null;
  const ddClient = useMemo(() => (isDemo ? null : getDDClient()), [isDemo]);
  const [config, setConfig] = useState<ExtensionConfig>(() => demoState?.config ?? loadConfig());
  const [phase, setPhase] = useState<ContainerPhase>(demoState?.phase ?? 'missing');
  const [statusText, setStatusText] = useState(demoState?.statusText ?? 'No OpenClaw container yet');
  const [token, setToken] = useState(demoState?.token ?? '');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(demoState?.message ?? '');
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState(demoState?.debugLog ?? '');

  const persistConfig = useCallback((next: ExtensionConfig) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConfig(next);
  }, []);

  const openUrl = useMemo(() => `http://127.0.0.1:${config.port}`, [config.port]);
  const wsUrl = useMemo(() => `ws://127.0.0.1:${config.port}`, [config.port]);

  const asText = useCallback((value: unknown) => {
    return typeof value === 'string' ? value : '';
  }, []);

  const findContainer = useCallback(async (): Promise<ContainerSnapshot | null> => {
    if (!ddClient) {
      return null;
    }

    const containers = (await ddClient.docker.listContainers({
      all: true,
      filters: {
        label: Object.entries(LABELS).map(([key, value]) => `${key}=${value}`),
      },
    })) as Array<{
      Id: string;
      State: string;
      Status: string;
      Names?: string[];
      Name?: string;
    }>;

    if (containers.length > 0) {
      const container = containers[0];
      return { id: container.Id, state: container.State, status: container.Status };
    }

    const byName = (await ddClient.docker.listContainers({
      all: true,
      filters: { name: [CONTAINER_NAME] },
    })) as Array<{ Id: string; State: string; Status: string }>;

    if (byName.length === 0) {
      return null;
    }

    return { id: byName[0].Id, state: byName[0].State, status: byName[0].Status };
  }, [ddClient]);

  const appendDebug = useCallback((entry: string) => {
    setDebugLog((current) => {
      const next = current ? `${current}\n${entry}` : entry;
      return next.slice(-12000);
    });
  }, []);

  const readToken = useCallback(async (containerId: string) => {
    if (!ddClient) {
      return;
    }

    try {
      const result = (await ddClient.docker.cli.exec('exec', [
        containerId,
        'node',
        '-e',
        'const fs=require("fs"); const file="/home/node/.openclaw/openclaw.json"; if (!fs.existsSync(file)) { process.exit(0); } const cfg=JSON.parse(fs.readFileSync(file,"utf8")); process.stdout.write(cfg.gateway?.auth?.token || "");',
      ])) as CliExecResult;
      setToken(asText((result as CliExecResult).stdout).trim());
    } catch (err) {
      appendDebug(`token read failed: ${err instanceof Error ? err.message : String(err)}`);
      setToken('');
    }
  }, [appendDebug, asText, ddClient]);

  const checkReady = useCallback(async () => {
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
  }, [openUrl]);

  const readDockerServerArch = useCallback(async () => {
    if (!ddClient) {
      return '';
    }

    const result = (await ddClient.docker.cli.exec('version', ['--format', '{{.Server.Arch}}'])) as CliExecResult;
    return asText(result.stdout).trim();
  }, [asText, ddClient]);

  const requireSupportedPlatform = useCallback(async () => {
    try {
      const serverArch = await readDockerServerArch();
      if (!serverArch) {
        appendDebug('docker server architecture was empty; continuing with linux/arm64 runtime platform');
        return;
      }

      appendDebug(`docker server architecture: ${serverArch}`);
      if (serverArch !== SUPPORTED_DOCKER_ARCH) {
        throw new Error(
          `Unsupported Docker architecture: ${serverArch}. This extension currently runs the OpenClaw service as ${RUNTIME_PLATFORM} for Apple Silicon Macs. Intel Mac and multi-arch support are not complete yet.`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Unsupported Docker architecture:')) {
        throw err;
      }
      appendDebug(`docker server architecture check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [appendDebug, readDockerServerArch]);

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    try {
      const container = await findContainer();
      if (!container) {
        setPhase('missing');
        setStatusText('No OpenClaw container yet');
        setToken('');
        return { phase: 'missing', ready: false };
      }

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
      return { phase: container.state === 'exited' ? 'stopped' : 'error', ready: false };
    } catch (err) {
      setPhase('error');
      setStatusText('Failed to inspect container');
      setError(String(err));
      return { phase: 'error', ready: false };
    }
  }, [checkReady, findContainer, readToken]);

  const runAndPoll = useCallback(async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      appendDebug(`poll attempt ${attempt + 1}`);
      const result = await refresh();
      if (result.ready) {
        appendDebug('host health check passed');
        break;
      }
      if (attempt < 19) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
    }
  }, [appendDebug, refresh]);

  const createOrStart = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    setPhase('starting');
    setStatusText('Creating OpenClaw container...');
    try {
      await requireSupportedPlatform();
      const existing = await findContainer();
      if (existing) {
        appendDebug(`found existing container ${existing.id} (${existing.state})`);
        await ddClient.docker.cli.exec('start', [existing.id]);
        setStatusText('Starting existing OpenClaw container...');
      } else {
        appendDebug(`creating container ${CONTAINER_NAME} from ${config.image}`);
        const result = (await ddClient.docker.cli.exec('run', [
          '-d',
          '--name',
          CONTAINER_NAME,
          '--platform',
          RUNTIME_PLATFORM,
          '-v',
          `${VOLUME_NAME}:/home/node`,
          '-p',
          `127.0.0.1:${config.port}:${BRIDGE_PORT}`,
          '--label',
          `com.docker.extension.openclaw=${LABELS['com.docker.extension.openclaw']}`,
          '--label',
          `com.docker.extension.openclaw.role=${LABELS['com.docker.extension.openclaw.role']}`,
          config.image,
        ])) as CliExecResult;
        const stdout = asText(result.stdout).trim();
        const stderr = asText(result.stderr).trim();
        appendDebug(`docker run stdout: ${stdout || '<empty>'}`);
        if (stderr) {
          appendDebug(`docker run stderr: ${stderr}`);
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const created = await findContainer();
        if (!created) {
          const ps = (await ddClient.docker.cli.exec('ps', ['-a'])) as CliExecResult;
          appendDebug(`docker ps -a:\n${asText(ps.stdout).trim()}`);
          throw new Error(
            stderr ||
              stdout ||
              'Docker reported success, but no OpenClaw service container was created.',
          );
        }
      }

      setMessage('OpenClaw setup started. The first launch can take a minute while socat is installed.');
      await runAndPoll();
    } catch (err) {
      setPhase('error');
      const text = err instanceof Error ? err.message : String(err);
      appendDebug(`create/start failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, asText, config.image, config.port, ddClient, findContainer, runAndPoll]);

  const stop = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      const container = await findContainer();
      if (container) {
        await ddClient.docker.cli.exec('stop', [container.id]);
      }
      await refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      appendDebug(`stop failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, ddClient, findContainer, refresh]);

  const restart = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    setBusy(true);
    setError('');
    try {
      const container = await findContainer();
      if (container) {
        await ddClient.docker.cli.exec('restart', [container.id]);
        await runAndPoll();
      } else {
        await createOrStart();
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      appendDebug(`restart failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, createOrStart, ddClient, findContainer, runAndPoll]);

  const remove = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const container = await findContainer();
      if (container) {
        await ddClient.docker.cli.exec('rm', ['-f', container.id]);
      }
      setToken('');
      await refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      appendDebug(`remove failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [appendDebug, ddClient, findContainer, refresh]);

  const openBrowser = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    await Promise.resolve(ddClient.host.openExternal(openUrl));
  }, [ddClient, openUrl]);

  const copyToken = useCallback(async () => {
    if (!token) {
      return;
    }
    await navigator.clipboard.writeText(token);
    setMessage('Gateway token copied to clipboard.');
  }, [token]);

  const saveAnthropicKey = useCallback(async () => {
    if (!ddClient) {
      return;
    }

    const key = anthropicApiKey.trim();
    if (!key) {
      setError('Enter an Anthropic API key first.');
      return;
    }
    if (/[\r\n]/.test(key)) {
      setError('Anthropic API key must not contain newline characters.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const container = await findContainer();
      if (!container) {
        throw new Error('Start OpenClaw before configuring provider credentials.');
      }

      if (container.state !== 'running') {
        appendDebug(`container ${container.id} is in state "${container.state}", starting it before writing Anthropic API key`);
        await ddClient.docker.cli.exec('start', [container.id]);
      }

      appendDebug('writing Anthropic API key to /home/node/.openclaw/.env');
      await ddClient.docker.cli.exec('exec', [
        '-e',
        'OPENCLAW_ANTHROPIC_API_KEY',
        '-u',
        'node',
        container.id,
        'node',
        '-e',
        `
const fs = require("fs");
const dir = "/home/node/.openclaw";
const path = "/home/node/.openclaw/.env";
const key = process.env.OPENCLAW_ANTHROPIC_API_KEY || "";
if (!key) {
  process.stderr.write("Anthropic API key was not provided to the container process.\\n");
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
const lines = fs.existsSync(path)
  ? fs.readFileSync(path, "utf8").split(/\\r?\\n/)
  : [];
const filtered = lines.filter((line) => line && !line.startsWith("ANTHROPIC_API_KEY="));
filtered.push("ANTHROPIC_API_KEY=" + key);
fs.writeFileSync(path, filtered.join("\\n") + "\\n", { mode: 0o600 });
fs.chmodSync(path, 0o600);
        `.trim(),
      ], {
        env: {
          OPENCLAW_ANTHROPIC_API_KEY: key,
        },
      });

      appendDebug('restarting service after Anthropic key update');
      setAnthropicApiKey('');
      await ddClient.docker.cli.exec('restart', [container.id]);
      setMessage('Anthropic API key saved to the persistent OpenClaw state volume.');
      await runAndPoll();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      appendDebug(`anthropic key save failed: ${text}`);
      setError(text);
    } finally {
      setBusy(false);
    }
  }, [anthropicApiKey, appendDebug, ddClient, findContainer, runAndPoll]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    void refresh();
  }, [isDemo, refresh]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (config.autoStart && phase === 'missing' && !busy) {
      void createOrStart();
    }
  }, [busy, config.autoStart, createOrStart, isDemo, phase]);

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

        <Alert severity="info">
          This is a more isolated local wrapper, not a strong security boundary. The service is
          exposed on localhost only, and provider auth is stored in the persistent Docker volume.
        </Alert>

        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}

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
                  startIcon={<PlayArrowIcon />}
                  onClick={() => void createOrStart()}
                  disabled={busy || isDemo}
                >
                  Start
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => void restart()}
                  disabled={busy || isDemo}
                >
                  Restart
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<StopIcon />}
                  onClick={() => void stop()}
                  disabled={busy || isDemo}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => void remove()}
                  disabled={busy || isDemo}
                >
                  Remove Container
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<LaunchIcon />}
                  onClick={() => void openBrowser()}
                  disabled={busy || isDemo || phase !== 'running'}
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
              <Typography variant="h5">Provider Auth</Typography>
              <TextField
                label="Anthropic API Key"
                type="password"
                value={anthropicApiKey}
                fullWidth
                autoComplete="off"
                onChange={(event) => setAnthropicApiKey(event.target.value)}
                helperText="First-run step. Write-only. Saved into /home/node/.openclaw/.env in the persistent Docker volume, then the service is restarted."
              />
              <Button
                variant="outlined"
                onClick={() => void saveAnthropicKey()}
                disabled={busy || isDemo || !anthropicApiKey.trim()}
              >
                Save Anthropic Key
              </Button>
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
                  helperText="Paste this into OpenClaw Control if the dashboard asks for a token."
                />
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => void copyToken()}
                  disabled={isDemo || !token}
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
                label="OpenClaw Image"
                value={config.image}
                fullWidth
                onChange={(event) => setConfig((current) => ({ ...current, image: event.target.value }))}
                helperText="This should point to the local runtime image that bundles the macOS socat bridge."
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
                  if (isDemo) {
                    return;
                  }
                  persistConfig(config);
                  setMessage('Settings saved. Restart the container to apply changes.');
                }}
                disabled={isDemo}
              >
                Save Settings
              </Button>
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
              <Typography variant="body2" color="text.secondary">
                OpenClaw itself runs as the non-root `node` user after the upstream entrypoint starts.
                The wrapper still is not a hardened sandbox: it keeps writable state in a named Docker
                volume, and the local bridge process exists to make localhost access work on macOS.
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
              <Typography variant="h5">Debug Output</Typography>
              <TextField
                value={debugLog}
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
