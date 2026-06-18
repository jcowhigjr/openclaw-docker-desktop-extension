# Hardware Profile System Specification

## Overview
A comprehensive system to detect, configure, and optimize OpenClaw for local models on different Mac hardware configurations, with specific focus on M4 Macs with 24GB RAM.

## Goals
1. **Automatic Detection**: Identify user's hardware capabilities (chip, RAM, GPU)
2. **Smart Recommendations**: Suggest optimal models and configurations
3. **Performance Warnings**: Alert users before they select models that may timeout
4. **One-Click Optimization**: Apply tested configurations for specific hardware
5. **Documentation**: Provide clear guidance for manual tuning

## Target Hardware Profiles

### Profile: Balanced (Primary Focus)
**Target Hardware**: M4 Mac (base/Pro) with 24GB unified memory

**Why This Matters**:
- Base M4: 120 GB/s memory bandwidth
- M4 Pro: 273 GB/s memory bandwidth
- Unified memory allows efficient GPU offload
- 24GB is the sweet spot for running 8-14B models comfortably

**Research Findings for M4 24GB**:

| Model | Params | RAM Used | Tokens/sec | Use Case |
|-------|--------|----------|------------|----------|
| **gemma4-fast** | 4B | ~3GB | 35-45 tok/s | Fast daily driver |
| **qwen2.5:3b** | 3B | ~2GB | 40-50 tok/s | Ultra-fast responses |
| **qwen3:8b** | 8B | ~5GB | 28-35 tok/s | Fast, capable |
| **llama3.2** | 8B | ~5GB | 24-28 tok/s | General purpose |
| **gemma4** | 9B | ~6GB | 20-25 tok/s | Best balance |
| **qwen3.5** | 9.7B | ~6GB | 15-20 tok/s | Higher quality |
| **qwen3:14b** | 14B | ~9GB | 10-16 tok/s | Slower, stronger |
| **qwen3.5:27b** | 27B | ~16GB | 6-10 tok/s | Top quality, tight fit |

**Key Insights from Research**:
1. **MLX Backend**: Ollama 0.19+ uses Apple MLX framework → 1.7-3.4x faster than llama.cpp
2. **Flash Attention**: `OLLAMA_FLASH_ATTENTION=1` reduces memory and improves speed
3. **KV Cache Quantization**: `OLLAMA_KV_CACHE_TYPE=q8_0` uses ½ memory vs f16 with minimal quality loss
4. **Prompt Eval vs Generation**: Prompt eval (first tokens) is slower than generation (subsequent tokens)
5. **Context Matters**: 21K token prompt at 127 tok/s = 165s eval time (exceeds 120s timeout)

### Profile: Light
**Target Hardware**: 8-16GB RAM, CPU-only (older Macs, MacBook Air without GPU offload)

**Constraints**:
- Cannot run models >7B reliably
- Must use aggressive KV cache quantization (q4_0)
- Smaller context windows (8K instead of 16K)
- Must use lean mode and tool disabling

### Profile: Performance
**Target Hardware**: 32GB+ RAM with dedicated GPU (M4 Max, Studio, or discrete GPU setups)

**Capabilities**:
- Can run larger models (up to 70B with quantization)
- Full context windows (32K+)
- All tools enabled
- Higher parallelism possible

## Configuration Recommendations by Profile

### Balanced Profile (M4 24GB) - Detailed

#### Recommended Primary Configuration
```json
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      },
      "compaction": {
        "reserveTokens": 8192,
        "keepRecentTokens": 12000
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4:latest",
            "name": "Gemma 4",
            "params": {
              "num_ctx": 16384
            }
          }
        ]
      }
    }
  }
}
```

#### Ollama Host Environment
```bash
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_KEEP_ALIVE=30m
```

#### Workspace File Guidance
- Keep AGENTS.md under 8,000 characters
- SOUL.md under 5,000 characters
- Total workspace context under 15,000 characters

#### Model Selection Priority
1. **Primary**: `gemma4` (9B) - best balance of speed and capability
2. **Fast**: `gemma4-fast` (4B) - when speed matters most
3. **Capable**: `qwen3:8b` - stronger reasoning at good speed
4. **Heavy**: `qwen3:14b` - when quality trumps speed (expect ~30-40s prompt eval)

### Light Profile

```json
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      },
      "compaction": {
        "reserveTokens": 4096,
        "reserveTokensFloor": 0,
        "keepRecentTokens": 6000
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4-fast:latest",
            "params": {
              "num_ctx": 8192
            },
            "compat": {
              "supportsTools": false
            }
          }
        ]
      }
    }
  }
}
```

## UI/UX Specification

### Hardware Detection Flow

```
User opens extension
       │
       ▼
  [Check if hardware detected]
       │
       ├─ No ──▶ [Run detection]
       │            │
       │            ▼
       │       [Get system info via Docker SDK]
       │            │
       │            ▼
       │       [Store: chip, RAM, hasGpu]
       │            │
       │            ▼
       │       [Determine profile: light/balanced/performance]
       │
       ▼
  [Show profile in UI]
       │
       ▼
  [Recommend models]
       │
       ▼
  [Warn about timeout risks]
```

### Model Selection UI States

**State 1: Hardware Detected, No Model Selected**
```
┌────────────────────────────────────────────┐
│  Your Mac: M4 with 24GB RAM                │
│  Recommended for: Balanced profile          │
│                                            │
│  ⭐ Top picks for your Mac:                 │
│  • Gemma 4 - Best balance (~22 tok/s)     │
│  • Qwen3 8B - Fast & capable (~30 tok/s) │
│  • Gemma 4 Fast - Maximum speed (~40 tok/s)│
│                                            │
│  [Select Model] [View All Options]         │
└────────────────────────────────────────────┘
```

**State 2: Model Selected, Safe Settings Available**
```
┌────────────────────────────────────────────┐
│  Selected: Qwen3.5 (9.7B parameters)        │
│                                            │
│  On your M4 (24GB):                        │
│  • Estimated: ~18 tok/s                    │
│  • Context: 16K tokens                     │
│  • RAM usage: ~6GB                         │
│                                            │
│  ⚠️ Large prompts may take 30-45s to start  │
│                                            │
│  [Apply Safe Settings for M4]               │
│  This will:                               │
│  • Enable lean mode for smaller prompts    │
│  • Set context to 16K                      │
│  • Configure compaction                    │
└────────────────────────────────────────────┘
```

**State 3: High Risk Model Selected**
```
┌────────────────────────────────────────────┐
│  Selected: Qwen3 14B                        │
│                                            │
│  ⚠️ Timeout Risk on your hardware           │
│                                            │
│  This model:                               │
│  • Uses ~9GB RAM                           │
│  • Runs at ~13 tok/s on M4                 │
│  • May exceed 120s timeout on large prompts │
│                                            │
│  Recommendations:                          │
│  • Use smaller context (8K instead of 16K) │
│  • Enable aggressive lean mode             │
│  • Trim workspace files                     │
│  • Or select a smaller model                │
│                                            │
│  [Apply Risk Mitigation] [Choose Different] │
└────────────────────────────────────────────┘
```

## Technical Implementation

### Hardware Detection API

```typescript
// src/services/hardwareDetection.ts

interface HardwareProfile {
  platform: 'macos' | 'linux' | 'windows';
  chip: {
    family: 'intel' | 'apple-silicon';
    generation: 'm1' | 'm2' | 'm3' | 'm4' | 'm4-pro' | 'm4-max' | 'unknown';
    hasGpu: boolean;
    memoryBandwidthGBps: number | null; // 120 for base M4, 273 for M4 Pro, etc.
  };
  memory: {
    totalGB: number;
    unified: boolean; // true for Apple Silicon
  };
  recommendedProfile: 'light' | 'balanced' | 'performance';
}

async function detectHardware(): Promise<HardwareProfile> {
  // Approach: Use Docker exec to run system_profiler on macOS
  // Alternative: Parse userAgent in UI + memory estimate from performance API
}
```

### Configuration Builder

```typescript
// src/services/configBuilder.ts

interface ProfileConfig {
  ollamaEnv: {
    OLLAMA_FLASH_ATTENTION: '0' | '1';
    OLLAMA_KV_CACHE_TYPE: 'f16' | 'q8_0' | 'q4_0';
    OLLAMA_NUM_PARALLEL: string;
    OLLAMA_KEEP_ALIVE: string;
  };
  openclawConfig: {
    agents: {
      defaults: {
        experimental: { localModelLean: boolean };
        compaction: {
          reserveTokens?: number;
          reserveTokensFloor?: number;
          keepRecentTokens?: number;
        };
      };
    };
    models: {
      providers: {
        ollama: {
          models: Array<{
            id: string;
            params: { num_ctx: number };
            compat?: { supportsTools: boolean };
          }>;
        };
      };
    };
  };
}

function buildConfigForProfile(profile: 'light' | 'balanced' | 'performance'): ProfileConfig {
  // Return configuration object based on profile
}
```

### Model Metadata Database

```typescript
// src/data/modelMetadata.ts

export const MODEL_METADATA: Record<string, ModelMetadata> = {
  'gemma4:latest': {
    id: 'gemma4:latest',
    name: 'Gemma 4',
    parameters: 9,
    ramUsageGB: 6,
    performance: {
      'm4-base': { tokPerSecond: [20, 25] },
      'm4-pro': { tokPerSecond: [22, 28] },
      'cpu-light': { tokPerSecond: [8, 10] },
    },
    recommendedProfiles: ['balanced', 'performance'],
    contextWindow: 128000,
    bestFor: 'General purpose, good balance of speed and quality',
  },
  'qwen3:8b': {
    id: 'qwen3:8b',
    name: 'Qwen 3 8B',
    parameters: 8,
    ramUsageGB: 5,
    performance: {
      'm4-base': { tokPerSecond: [28, 35] },
      'm4-pro': { tokPerSecond: [30, 38] },
      'cpu-light': { tokPerSecond: [12, 15] },
    },
    recommendedProfiles: ['balanced', 'performance'],
    contextWindow: 32768,
    bestFor: 'Fast responses with good reasoning',
  },
  // ... more models
};
```

## Integration Points

### With Ollama Setup Flow
- Detect hardware at start of Ollama setup
- Show recommendations before model selection
- Apply safe settings on "Apply" action
- Store detected profile in extension config

### With Control UI
- Pass hardware profile info via URL fragment or state
- Show profile badge in Control UI header
- Allow profile-based UI adaptations (e.g., warn about compaction)

### With Runtime Container
- Pass OLLAMA_* environment variables when launching container
- Mount workspace volume with appropriate settings pre-configured

## Testing Strategy

### Manual Verification Matrix

| Hardware | Profile | Model | Context | Expected Tok/s | Timeout Risk |
|----------|---------|-------|---------|----------------|--------------|
| M4 24GB | Balanced | gemma4 | 16K | 20-25 | Low |
| M4 24GB | Balanced | qwen3:14b | 16K | 10-16 | Medium |
| M4 24GB | Balanced | qwen3:14b | 32K | 10-16 | High |
| M3 16GB | Light | gemma4-fast | 8K | 20-25 | Low |
| M3 16GB | Light | gemma4 | 8K | 10-12 | Medium |
| Intel 8GB | Light | qwen2.5:3b | 8K | 15-20 | Low |

### Automated Tests
- Unit tests for hardware detection logic
- Unit tests for configuration builder
- Integration tests for profile-based model filtering

## Success Metrics

1. **User Success Rate**: % of users who complete setup without timeout errors
2. **Model Appropriateness**: % of users on balanced hardware selecting appropriate models
3. **Configuration Adoption**: % of users who apply recommended settings
4. **Timeout Reduction**: Decrease in "LLM idle timeout" errors in logs

## Related Issues

- Issue #157: Hardware Profile Detection and UI
- Issue #158: Ollama Environment Variable Passthrough
- Issue #159: Workspace File Size Guard
- Issue #160: Model Selection UI with Performance Indicators
- docs/local-model-tuning.md

## Future Enhancements

1. **Real-time Performance Monitoring**: Measure actual tok/s on user's machine
2. **Adaptive Context Sizing**: Automatically adjust context based on measured performance
3. **Community Benchmarks**: Crowdsource performance data from users
4. **Non-Mac Support**: Extend detection to Windows/Linux (lower priority for this extension)
5. **Model Update Notifications**: Alert when better models become available for user's hardware
