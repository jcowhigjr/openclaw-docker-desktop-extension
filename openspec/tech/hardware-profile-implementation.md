# Hardware Profile System - Technical Implementation Design

## Architecture Overview

```
Extension Frontend (React/TypeScript)
├── HardwareProfileService          # Detection & profile logic
├── ModelMetadataService             # Performance database
├── RiskCalculator                   # Timeout risk assessment
├── ProfileConfigBuilder             # Generate optimal config
├── WorkspaceSizeService             # Check file sizes
└── React Components
    ├── HardwareProfileCard.tsx
    ├── ModelSelector.tsx
    ├── PerformanceIndicator.tsx
    └── SafeSettingsModal.tsx

Docker Desktop SDK
├── Container exec for hw detection
├── Volume inspection for workspace files
└── Container launch with env vars
```

---

## Core Types

```typescript
// src/types/hardware.ts

export type HardwareProfile = 'light' | 'balanced' | 'performance';

export interface DetectedHardware {
  platform: 'macos' | 'linux' | 'windows';
  chip: {
    family: 'intel' | 'apple-silicon';
    generation: 'm1' | 'm2' | 'm3' | 'm4' | 'm4-pro' | 'm4-max' | 'unknown';
    hasGpu: boolean;
    memoryBandwidthGBps: number | null;
  };
  memory: {
    totalGB: number;
    unified: boolean;
  };
  detectedAt: string;
}

export interface HardwareProfileConfig {
  profile: HardwareProfile;
  ollamaEnv: {
    OLLAMA_FLASH_ATTENTION: '0' | '1';
    OLLAMA_KV_CACHE_TYPE: 'f16' | 'q8_0' | 'q4_0';
    OLLAMA_NUM_PARALLEL: string;
    OLLAMA_KEEP_ALIVE: string;
  };
  openclawConfig: object;
  recommendedModels: string[];
  workspaceLimits: { maxFileSizeChars: number; maxTotalSizeChars: number };
}

export interface ModelMetadata {
  id: string;
  name: string;
  parameters: number;
  ramUsageGB: number;
  performance: Record<string, { tokPerSecond: [number, number] }>;
  riskProfile: Record<string, 'low' | 'medium' | 'high'>;
  recommendedProfiles: HardwareProfile[];
  contextWindow: number;
}
```

---

## Key Service Implementations

### HardwareProfileService

```typescript
export class HardwareProfileService {
  async detectHardware(): Promise<DetectedHardware> {
    // Try browser hints first (fast)
    const uaHints = this.detectFromUserAgent();
    
    // Fall back to Docker exec for detailed info
    const dockerInfo = await this.detectFromDocker();
    
    return this.mergeDetections(uaHints, dockerInfo);
  }
  
  determineProfile(hw: DetectedHardware): HardwareProfile {
    if (hw.chip.family === 'apple-silicon') {
      if (hw.memory.totalGB >= 32) return 'performance';
      if (hw.memory.totalGB >= 16 && hw.chip.hasGpu) return 'balanced';
    }
    return 'light';
  }
}
```

### Profile Configurations

```typescript
export const PROFILE_CONFIGS: Record<HardwareProfile, HardwareProfileConfig> = {
  balanced: {
    profile: 'balanced',
    ollamaEnv: {
      OLLAMA_FLASH_ATTENTION: '1',
      OLLAMA_KV_CACHE_TYPE: 'q8_0',
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_KEEP_ALIVE: '30m',
    },
    openclawConfig: {
      agents: {
        defaults: {
          experimental: { localModelLean: true },
          compaction: { reserveTokens: 8192, keepRecentTokens: 12000 },
        },
      },
      models: {
        providers: {
          ollama: {
            models: [{
              id: 'placeholder',
              params: { num_ctx: 16384 },
            }],
          },
        },
      },
    },
    recommendedModels: [
      'gemma4:latest',
      'qwen3:8b',
      'llama3.2:latest',
      'gemma4-fast:latest',
    ],
    workspaceLimits: { maxFileSizeChars: 10000, maxTotalSizeChars: 20000 },
  },
  // ... light and performance profiles similar
};
```

### Model Metadata (Key Models for M4 24GB)

```typescript
export const MODEL_METADATA: Record<string, ModelMetadata> = {
  'gemma4:latest': {
    id: 'gemma4:latest',
    name: 'Gemma 4',
    parameters: 9,
    ramUsageGB: 6,
    performance: {
      'm4-base': { tokPerSecond: [20, 25] },
      'balanced': { tokPerSecond: [15, 20] },
      'light': { tokPerSecond: [8, 10] },
    },
    riskProfile: {
      'm4-base': 'low',
      'balanced': 'medium',
      'light': 'high',
    },
    recommendedProfiles: ['balanced', 'performance'],
    contextWindow: 128000,
  },
  // ... other models (qwen3:8b, llama3.2, qwen3:14b, gemma4-fast, etc.)
};
```

### Risk Calculator

```typescript
export function calculateRisk(
  modelId: string,
  hardware: DetectedHardware,
  workspaceSize?: WorkspaceSizeInfo,
  estimatedPromptTokens = 15000
): TimeoutRiskAssessment {
  const model = MODEL_METADATA[modelId];
  const profile = determineProfile(hardware);
  const perf = model.performance[profile] || model.performance['balanced'];
  
  const promptEvalTime = estimatedPromptTokens / perf.tokPerSecond[0];
  const workspaceOverhead = workspaceSize?.estimatedEvalTimeSeconds || 0;
  const totalEvalTime = promptEvalTime + workspaceOverhead;
  
  let level: 'low' | 'medium' | 'high';
  if (totalEvalTime > 90) level = 'high';
  else if (totalEvalTime > 60) level = 'medium';
  else level = 'low';
  
  return {
    level,
    estimatedPromptEvalSeconds: Math.round(totalEvalTime),
    estimatedTokensPerSecond: Math.round(perf.tokPerSecond[0]),
    riskFactors: buildRiskFactors(model, hardware, totalEvalTime),
    mitigations: buildMitigations(model, profile, workspaceOverhead),
  };
}
```

---

## Integration Points

### 1. Ollama Setup Flow

Modify `OllamaSetupService.ts`:

```typescript
async startSetupFlow(): Promise<void> {
  // Detect hardware early
  const { hardware, profile, config } = await this.hardwareService.getOptimalConfig();
  this.state.hardware = hardware;
  this.state.profile = profile;
  
  // Show hardware banner in UI
  this.ui.showHardwareBanner(hardware, profile);
  
  // Continue with model selection...
}

async selectModel(modelId: string): Promise<void> {
  const risk = calculateRisk(modelId, this.state.hardware);
  this.state.selectedModelRisk = risk;
  
  // If high risk, show warning before applying
  if (risk.level === 'high') {
    await this.ui.showRiskWarning(risk);
  }
}
```

### 2. Config Application

```typescript
async applySafeSettings(modelId: string): Promise<void> {
  const { profile, config } = await this.hardwareService.getOptimalConfig();
  
  // Merge profile config with selected model
  const modelConfig = buildModelConfig(profile, modelId);
  
  // Apply to OpenClaw via existing ollamaSetup flow
  await this.ollamaSetup.applyModelConfig(modelConfig);
  
  // Show Ollama env var guidance
  this.ui.showOllamaEnvGuidance(config.ollamaEnv);
}
```

### 3. Workspace Size Check

```typescript
async checkWorkspaceSizes(): Promise<WorkspaceSizeInfo> {
  const result = await this.ddClient.docker.cli.exec('exec', [
    'openclaw-docker-desktop-extension-runtime',
    'sh', '-c',
    'cd /home/node/.openclaw/workspace && wc -c AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md'
  ]);
  
  return this.parseSizeOutput(result.stdout);
}
```

---

## UI Component Structure

```typescript
// HardwareProfileCard.tsx
interface Props {
  hardware: DetectedHardware;
  profile: HardwareProfile;
  onOptimize: () => void;
  onChangeProfile: (profile: HardwareProfile) => void;
}

// ModelSelector.tsx
interface Props {
  hardware: DetectedHardware;
  availableModels: string[];
  onSelect: (modelId: string, risk: TimeoutRiskAssessment) => void;
}

// PerformanceIndicator.tsx
interface Props {
  modelId: string;
  hardware: DetectedHardware;
  showDetails?: boolean;
}

// SafeSettingsModal.tsx
interface Props {
  modelId: string;
  risk: TimeoutRiskAssessment;
  profileConfig: HardwareProfileConfig;
  onApply: () => void;
  onCustomize: () => void;
  onSkip: () => void;
}
```

---

## State Management

```typescript
interface HardwareProfileState {
  detected?: {
    hardware: DetectedHardware;
    profile: HardwareProfile;
    config: HardwareProfileConfig;
  };
  selectedModel?: {
    id: string;
    risk: TimeoutRiskAssessment;
  };
  workspaceSize?: WorkspaceSizeInfo;
  appliedSettings?: {
    timestamp: string;
    config: HardwareProfileConfig;
  };
}

// Use React Context for global state
const HardwareContext = createContext<{
  state: HardwareProfileState;
  detect: () => Promise<void>;
  selectModel: (id: string) => Promise<void>;
  applySettings: () => Promise<void>;
}>();
```

---

## File Structure

```
src/
├── services/
│   ├── hardware/
│   │   ├── HardwareProfileService.ts
│   │   ├── hardwareDetection.ts
│   │   └── riskCalculator.ts
│   ├── config/
│   │   ├── ProfileConfigBuilder.ts
│   │   └── OllamaConfigApplier.ts
│   └── workspace/
│       └── WorkspaceSizeService.ts
├── components/
│   ├── hardware/
│   │   ├── HardwareProfileCard.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── PerformanceIndicator.tsx
│   │   └── SafeSettingsModal.tsx
│   └── workspace/
│       └── WorkspaceSizeGuard.tsx
├── data/
│   └── modelMetadata.ts
├── types/
│   └── hardware.ts
├── hooks/
│   └── useHardwareProfile.ts
└── context/
    └── HardwareContext.tsx
```

---

## Implementation Phases

### Phase 1: Detection & Display (MVP)
- Hardware detection via userAgent + Docker info
- Hardware banner component
- Model metadata database (6-8 key models)

### Phase 2: Model Selection
- Model selector with performance indicators
- Risk calculation and display
- Basic safe settings modal

### Phase 3: Config Application
- Profile config builder
- Integration with ollamaSetup flow
- Ollama env var guidance UI

### Phase 4: Workspace & Diagnostics
- Workspace size checking
- File size guard component
- Settings panel integration

---

## Testing Strategy

### Unit Tests
- Hardware detection logic
- Profile determination algorithm
- Risk calculation edge cases
- Config builder output validation

### Integration Tests
- Full setup flow with mocked Docker
- Model selection → config application chain
- State persistence across sessions

### Manual Verification
- Test on actual M4 24GB Mac
- Verify all recommended models install and run
- Confirm timeout risk estimates match reality
- Validate workspace size calculations
