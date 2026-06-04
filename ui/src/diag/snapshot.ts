// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 John Cowhig Jr.
import type { OllamaModel } from '../ollamaSetup';
import type { DiagAttrValue } from './events';

export type OllamaState = {
  phase: string;
  busy: boolean;
  ollamaChecking: boolean;
  ollamaStatus: string;
  ollamaAlertSeverity: string;
  selectedOllamaModel: string;
  configuredOllamaModel: string;
  models: OllamaModel[];
  actionSeq: number;
  appliedSeq: number;
};

export type OllamaSnapshot = Record<string, DiagAttrValue>;

export function captureOllamaSnapshot(state: OllamaState): OllamaSnapshot {
  const names = state.models.map((model) => model.name);
  return {
    phase: state.phase,
    busy: state.busy,
    ollamaChecking: state.ollamaChecking,
    ollamaStatus: state.ollamaStatus,
    ollamaAlertSeverity: state.ollamaAlertSeverity,
    selectedOllamaModel: state.selectedOllamaModel,
    configuredOllamaModel: state.configuredOllamaModel,
    modelsCount: names.length,
    selectedInDetectedList: state.selectedOllamaModel !== '' && names.includes(state.selectedOllamaModel),
    configuredInDetectedList: state.configuredOllamaModel !== '' && names.includes(state.configuredOllamaModel),
    actionSeq: state.actionSeq,
    appliedSeq: state.appliedSeq,
  };
}

export function hasOllamaInvariantViolation(state: OllamaState): boolean {
  const names = state.models.map((model) => model.name);
  const selectedDangling = state.selectedOllamaModel !== '' && !names.includes(state.selectedOllamaModel);
  const staleApply = state.appliedSeq < state.actionSeq;
  return selectedDangling || staleApply;
}
