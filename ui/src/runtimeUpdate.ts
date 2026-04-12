export type UpdatePolicy = 'check-only' | 'auto-before-launch';

export type RuntimeUpdateCheckResult = {
  image: string;
  supported: boolean;
  updateAvailable: boolean;
  checkedAt: number;
  localDigest?: string;
  remoteDigest?: string;
  localVersion?: string;
  error?: string;
};

const UPDATEABLE_RUNTIME_TAGS = new Set(['latest', 'main', 'stable', 'beta', 'dev']);
const SHA256_DIGEST_REGEX = /\bsha256:[a-f0-9]{64}\b/i;

type DockerImageInspectEntry = {
  RepoDigests?: string[];
  Config?: {
    Labels?: Record<string, string>;
  };
};

export function getImageTag(image: string): string | null {
  const trimmed = image.trim();
  if (!trimmed || trimmed.includes('@')) {
    return null;
  }

  const lastSlash = trimmed.lastIndexOf('/');
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= lastSlash) {
    return null;
  }

  return trimmed.slice(lastColon + 1).trim().toLowerCase() || null;
}

export function isRuntimeImageUpdateable(image: string): boolean {
  const trimmed = image.trim().toLowerCase();
  if (!trimmed.startsWith('ghcr.io/')) {
    return false;
  }

  const tag = getImageTag(image);
  return tag !== null && UPDATEABLE_RUNTIME_TAGS.has(tag);
}

export function shouldAutoApplyRuntimeUpdate(
  policy: UpdatePolicy,
  result: RuntimeUpdateCheckResult | null,
): boolean {
  return policy === 'auto-before-launch' && Boolean(result?.updateAvailable);
}

export function shortenDigest(digest?: string): string | null {
  if (!digest) {
    return null;
  }

  const normalized = digest.trim().toLowerCase();
  if (!SHA256_DIGEST_REGEX.test(normalized)) {
    return null;
  }

  return normalized.replace('sha256:', '').slice(0, 12);
}

export function describeRuntimeImageVersion(
  image: string,
  version?: string,
  digest?: string,
): string {
  if (version && version.trim()) {
    return version.trim();
  }

  const tag = getImageTag(image);
  const shortDigest = shortenDigest(digest);
  if (tag && shortDigest) {
    return `${tag}@${shortDigest}`;
  }
  if (tag) {
    return tag;
  }
  if (shortDigest) {
    return shortDigest;
  }
  return image;
}

export function extractDigestFromRepoDigest(repoDigest: string): string | null {
  if (!repoDigest || typeof repoDigest !== 'string') {
    return null;
  }

  const atIndex = repoDigest.lastIndexOf('@');
  if (atIndex < 0) {
    return null;
  }

  const digest = repoDigest.slice(atIndex + 1).trim().toLowerCase();
  return SHA256_DIGEST_REGEX.test(digest) ? digest : null;
}

export function parseLocalImageInspect(stdout: string): {
  digests: string[];
  version?: string;
} {
  if (!stdout.trim()) {
    return { digests: [] };
  }

  const payload = JSON.parse(stdout) as DockerImageInspectEntry[];
  if (!Array.isArray(payload) || payload.length === 0) {
    return { digests: [] };
  }

  const digests = Array.from(
    new Set(
      payload
        .flatMap((entry) => entry.RepoDigests ?? [])
        .map((value) => extractDigestFromRepoDigest(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const labels = payload[0]?.Config?.Labels ?? {};
  const version = labels['org.opencontainers.image.version']?.trim() || undefined;

  return { digests, version };
}

export function parseRemoteDigestFromBuildxOutput(stdout: string): string | null {
  if (!stdout) {
    return null;
  }

  const match = stdout.match(/^\s*Digest:\s*(sha256:[a-f0-9]{64})\s*$/im);
  return match?.[1]?.toLowerCase() ?? null;
}

export function parseRemoteDigestFromManifest(stdout: string): string | null {
  if (!stdout.trim()) {
    return null;
  }

  const payload = JSON.parse(stdout) as Record<string, unknown>;
  const digest = typeof payload.Digest === 'string' ? payload.Digest.trim().toLowerCase() : '';
  return SHA256_DIGEST_REGEX.test(digest) ? digest : null;
}
