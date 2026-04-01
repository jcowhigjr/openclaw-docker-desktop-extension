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

const STORAGE_KEY = 'openclaw-docker-extension-config';
const CONTAINER_NAME = 'openclaw-docker-extension-service';
const VOLUME_NAME = 'openclaw-docker-extension-home';
const BRIDGE_PORT = 18790;
const DEFAULT_RUNTIME_IMAGE = 'openclaw-docker-extension-runtime:dev';
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
    return {
      image:
        typeof parsed.image === 'string' && parsed.image.trim()
          ? parsed.image.trim() === 'ghcr.io/openclaw/openclaw:latest'
            ? DEFAULT_RUNTIME_IMAGE
            : parsed.image
          : DEFAULT_CONFIG.image,
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

export function App() {
  const ddClient = useMemo(() => getDDClient(), []);
  const [config, setConfig] = useState<ExtensionConfig>(loadConfig);
  const [phase, setPhase] = useState<ContainerPhase>('missing');
  const [statusText, setStatusText] = useState('No OpenClaw container yet');
  const [token, setToken] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState('');

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
    setBusy(true);
    setError('');
    setMessage('');
    setPhase('starting');
    setStatusText('Creating OpenClaw container...');
    try {
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
          'linux/arm64',
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
    const key = anthropicApiKey.trim();
    if (!key) {
      setError('Enter an Anthropic API key first.');
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
        '-u',
        'node',
        container.id,
        'node',
        '-e',
        `
const fs = require("fs");
const path = "/home/node/.openclaw/.env";
const key = process.env.OPENCLAW_ANTHROPIC_API_KEY || "";
if (!key) {
  process.stderr.write("Anthropic API key was not provided to the container process.\\n");
  process.exit(1);
}
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
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (config.autoStart && phase === 'missing' && !busy) {
      void createOrStart();
    }
  }, [busy, config.autoStart, createOrStart, phase]);

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
                  disabled={busy}
                >
                  Start
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
                  disabled={busy || phase !== 'running'}
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
                  helperText="Paste this into OpenClaw Control if the dashboard asks for a token."
                />
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
              <Typography variant="h5">Provider Auth</Typography>
              <TextField
                label="Anthropic API Key"
                type="password"
                value={anthropicApiKey}
                fullWidth
                autoComplete="off"
                onChange={(event) => setAnthropicApiKey(event.target.value)}
                helperText="Write-only. Saved into /home/node/.openclaw/.env in the persistent Docker volume, then the service is restarted."
              />
              <Button
                variant="outlined"
                onClick={() => void saveAnthropicKey()}
                disabled={busy || !anthropicApiKey.trim()}
              >
                Save Anthropic Key
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
