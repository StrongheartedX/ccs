/**
 * Constants for Quick Setup Wizard
 */

import type { ProviderOption } from './types';

export const PROVIDERS: ProviderOption[] = [
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro/Flash models' },
  { id: 'codex', name: 'OpenAI Codex', description: 'GPT-4 and codex models' },
  { id: 'agy', name: 'Antigravity', description: 'Antigravity AI models' },
  { id: 'qwen', name: 'Alibaba Qwen', description: 'Qwen Code models' },
  { id: 'iflow', name: 'iFlow', description: 'iFlow AI models' },
  { id: 'kiro', name: 'Kiro (AWS)', description: 'AWS CodeWhisperer models' },
  { id: 'copilot', name: 'GitHub Copilot', description: 'GitHub Copilot models' },
];

export const ALL_STEPS = ['provider', 'auth', 'variant', 'success'];

export function getStepProgress(step: string): number {
  if (step === 'account') return 1; // Same as auth
  return ALL_STEPS.indexOf(step);
}
