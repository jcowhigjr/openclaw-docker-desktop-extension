import { describe, it, expect } from 'vitest';
import {
  buildLocalModelGuidance,
  getCondensedGuidance,
  buildEnvVarGuidance,
} from './ollamaGuidance';

describe('ollamaGuidance', () => {
  describe('buildLocalModelGuidance', () => {
    it('returns guidance sections with required fields', () => {
      const guidance = buildLocalModelGuidance();

      expect(guidance).toBeInstanceOf(Array);
      expect(guidance.length).toBeGreaterThan(0);

      for (const section of guidance) {
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('content');
        expect(typeof section.title).toBe('string');
        expect(typeof section.content).toBe('string');
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.content.length).toBeGreaterThan(0);
      }
    });

    it('includes One Model at a Time section', () => {
      const guidance = buildLocalModelGuidance();
      const oneModelSection = guidance.find(
        (s) => s.title === 'One Model at a Time'
      );

      expect(oneModelSection).toBeDefined();
      expect(oneModelSection!.content).toContain('cache');
      expect(oneModelSection!.content).toContain('timeout');
      expect(oneModelSection!.link).toContain('local-model-tuning.md');
    });

    it('includes OLLAMA_MAX_LOADED_MODELS section', () => {
      const guidance = buildLocalModelGuidance();
      const maxLoadedSection = guidance.find((s) =>
        s.title.includes('OLLAMA_MAX_LOADED_MODELS')
      );

      expect(maxLoadedSection).toBeDefined();
      expect(maxLoadedSection!.content).toContain('RAM');
    });

    it('includes OLLAMA_FLASH_ATTENTION section', () => {
      const guidance = buildLocalModelGuidance();
      const flashAttentionSection = guidance.find((s) =>
        s.title.includes('OLLAMA_FLASH_ATTENTION')
      );

      expect(flashAttentionSection).toBeDefined();
      expect(flashAttentionSection!.content).toContain('faster');
    });

    it('includes OLLAMA_KV_CACHE_TYPE section', () => {
      const guidance = buildLocalModelGuidance();
      const kvCacheSection = guidance.find((s) =>
        s.title.includes('OLLAMA_KV_CACHE_TYPE')
      );

      expect(kvCacheSection).toBeDefined();
      expect(kvCacheSection!.content).toContain('memory');
    });

    it('includes Recommended Models section for M4 Mac', () => {
      const guidance = buildLocalModelGuidance();
      const modelsSection = guidance.find((s) =>
        s.title.includes('Recommended Models')
      );

      expect(modelsSection).toBeDefined();
      expect(modelsSection!.content).toContain('gemma4-fast');
      expect(modelsSection!.content).toContain('qwen3.5');
    });
  });

  describe('getCondensedGuidance', () => {
    it('returns a non-empty string', () => {
      const guidance = getCondensedGuidance();

      expect(typeof guidance).toBe('string');
      expect(guidance.length).toBeGreaterThan(0);
    });

    it('mentions cache eviction', () => {
      const guidance = getCondensedGuidance();

      expect(guidance).toContain('cache');
    });

    it('mentions OLLAMA_MAX_LOADED_MODELS', () => {
      const guidance = getCondensedGuidance();

      expect(guidance).toContain('OLLAMA_MAX_LOADED_MODELS');
    });

    it('mentions timeout', () => {
      const guidance = getCondensedGuidance();

      expect(guidance).toContain('timeout');
    });

    it('is concise (under 300 characters)', () => {
      const guidance = getCondensedGuidance();

      expect(guidance.length).toBeLessThan(300);
    });
  });

  describe('buildEnvVarGuidance', () => {
    it('returns environment variable guidance', () => {
      const envVars = buildEnvVarGuidance();

      expect(envVars).toBeInstanceOf(Array);
      expect(envVars.length).toBeGreaterThan(0);
    });

    it('includes OLLAMA_MAX_LOADED_MODELS', () => {
      const envVars = buildEnvVarGuidance();
      const maxLoaded = envVars.find((v) => v.name === 'OLLAMA_MAX_LOADED_MODELS');

      expect(maxLoaded).toBeDefined();
      expect(maxLoaded!.value).toBe('2');
      expect(maxLoaded!.description).toContain('cache');
    });

    it('includes OLLAMA_FLASH_ATTENTION', () => {
      const envVars = buildEnvVarGuidance();
      const flashAttention = envVars.find(
        (v) => v.name === 'OLLAMA_FLASH_ATTENTION'
      );

      expect(flashAttention).toBeDefined();
      expect(flashAttention!.value).toBe('1');
      expect(flashAttention!.description).toContain('faster');
    });

    it('includes OLLAMA_KV_CACHE_TYPE', () => {
      const envVars = buildEnvVarGuidance();
      const kvCache = envVars.find((v) => v.name === 'OLLAMA_KV_CACHE_TYPE');

      expect(kvCache).toBeDefined();
      expect(kvCache!.value).toBe('q8_0');
      expect(kvCache!.description).toContain('memory');
    });

    it('each entry has name, value, and description', () => {
      const envVars = buildEnvVarGuidance();

      for (const envVar of envVars) {
        expect(envVar).toHaveProperty('name');
        expect(envVar).toHaveProperty('value');
        expect(envVar).toHaveProperty('description');
        expect(typeof envVar.name).toBe('string');
        expect(typeof envVar.value).toBe('string');
        expect(typeof envVar.description).toBe('string');
        expect(envVar.name.length).toBeGreaterThan(0);
        expect(envVar.value.length).toBeGreaterThan(0);
        expect(envVar.description.length).toBeGreaterThan(0);
      }
    });
  });
});