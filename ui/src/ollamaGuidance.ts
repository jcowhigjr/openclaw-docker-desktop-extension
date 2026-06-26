// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
/**
 * Ollama guidance module - provides static guidance for local model optimization
 * and cache eviction prevention.
 */

export interface GuidanceSection {
  title: string;
  content: string;
  link?: string;
}

/**
 * Build comprehensive guidance for local Ollama model optimization.
 * This guidance helps users avoid KV cache eviction and timeout issues.
 */
export function buildLocalModelGuidance(): GuidanceSection[] {
  return [
    {
      title: "One Model at a Time",
      content:
        "On local Ollama, using a different model per chat (or switching the dropdown) " +
        "evicts the first model's cache and causes slow replies or timeouts. " +
        "Each model switch forces a full re-evaluation of the system prompt (~8-40 seconds). " +
        "Use one model consistently across all chats for best performance.",
      link: "https://github.com/jcowhigjr/openclaw-docker-desktop-extension/blob/main/docs/local-model-tuning.md",
    },
    {
      title: "OLLAMA_MAX_LOADED_MODELS",
      content:
        "If you have sufficient RAM, set OLLAMA_MAX_LOADED_MODELS=2 (or higher) on your host Ollama. " +
        "This allows multiple models to coexist in memory without cache eviction. " +
        "Default is 1, which causes cache eviction when switching models.",
    },
    {
      title: "OLLAMA_FLASH_ATTENTION",
      content:
        "Set OLLAMA_FLASH_ATTENTION=1 on your host Ollama for 20-40% faster inference. " +
        "This optimizes attention computation and reduces prompt evaluation time.",
    },
    {
      title: "OLLAMA_KV_CACHE_TYPE",
      content:
        "Set OLLAMA_KV_CACHE_TYPE=q8_0 on your host Ollama for better memory efficiency. " +
        "This uses 8-bit quantization for the KV cache, reducing memory pressure.",
    },
    {
      title: "Recommended Models for M4 Mac 24GB",
      content:
        "• gemma4-fast:latest (8B) - Fastest, ~8s for large prompts\n" +
        "• qwen3.5:latest (9.7B) - Slower, ~40s for large prompts\n" +
        "• Avoid model switching between these - it causes cache eviction and timeouts.",
    },
  ];
}

/**
 * Get a condensed single-paragraph guidance for inline display.
 */
export function getCondensedGuidance(): string {
  return (
    "On local Ollama, a second model (switching the dropdown) evicts the first model's cache " +
    "and causes slow replies / timeouts. Use one model, or set OLLAMA_MAX_LOADED_MODELS≥2 " +
    "on your host (RAM permitting). See docs for more."
  );
}

/**
 * Build environment variable guidance card content.
 */
export function buildEnvVarGuidance(): { name: string; value: string; description: string }[] {
  return [
    {
      name: "OLLAMA_MAX_LOADED_MODELS",
      value: "2",
      description: "Allow 2 models in memory (default: 1). Prevents cache eviction when switching.",
    },
    {
      name: "OLLAMA_FLASH_ATTENTION",
      value: "1",
      description: "Enable flash attention for 20-40% faster inference.",
    },
    {
      name: "OLLAMA_KV_CACHE_TYPE",
      value: "q8_0",
      description: "8-bit KV cache quantization for better memory efficiency.",
    },
  ];
}
