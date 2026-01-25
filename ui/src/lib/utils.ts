import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Vibrant Tones Palette
const VIBRANT_TONES = [
  '#f94144', // Strawberry Red
  '#f3722c', // Pumpkin Spice
  '#f8961e', // Carrot Orange
  '#f9844a', // Atomic Tangerine
  '#f9c74f', // Tuscan Sun
  '#90be6d', // Willow Green
  '#43aa8b', // Seaweed
  '#4d908e', // Dark Cyan
  '#577590', // Blue Slate
  '#277da1', // Cerulean
];

// Provider color mapping (fixed colors for consistency)
const PROVIDER_COLORS: Record<string, string> = {
  agy: '#f3722c', // Pumpkin
  gemini: '#277da1', // Cerulean
  codex: '#f8961e', // Carrot
  vertex: '#577590', // Blue Slate
  iflow: '#f94144', // Strawberry
  qwen: '#f9c74f', // Tuscan
  kiro: '#4d908e', // Dark Cyan (AWS-inspired)
  copilot: '#43aa8b', // Seaweed (GitHub-inspired)
};

// Status colors (from Analytics Cost breakdown) - darker for light theme contrast
export const STATUS_COLORS = {
  success: '#15803d', // Green-700 (was Seaweed #43aa8b)
  degraded: '#b45309', // Amber-700 (was Ochre #e09f3e)
  failed: '#b91c1c', // Red-700 (was Merlot #9e2a2b)
} as const;

export function getModelColor(model: string): string {
  // FNV-1a hash algorithm
  let hash = 0x811c9dc5;
  for (let i = 0; i < model.length; i++) {
    hash ^= model.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // Ensure positive index
  return VIBRANT_TONES[(hash >>> 0) % VIBRANT_TONES.length];
}

export function getProviderColor(provider: string): string {
  const normalized = provider.toLowerCase();
  return PROVIDER_COLORS[normalized] || getModelColor(provider);
}

/**
 * Sort models by tier: Primary (Claude/GPT) > Gemini 3 Pro > Gemini 2.5 > Others
 * Within each tier, sorts alphabetically by display name
 */
export function sortModelsByPriority<T extends { name: string; displayName?: string }>(
  models: T[]
): T[] {
  const getPriority = (model: T): number => {
    const name = (model.displayName || model.name).toLowerCase();

    // Tier 0: Primary models (Claude + GPT) - weekly limits, most valuable
    if (name.includes('claude') || name.includes('gpt')) return 0;

    // Tier 1: Gemini 3 Pro models - high capability
    if (name.includes('gemini 3') || name.includes('gemini-3')) return 1;

    // Tier 2: Gemini 2.5 Pro/Flash models - mid tier
    if (name.includes('gemini 2.5') || name.includes('gemini-2.5')) return 2;

    // Tier 3: Other Gemini models
    if (name.includes('gemini')) return 3;

    // Tier 4: Everything else
    return 4;
  };

  return [...models].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    // Same priority: sort alphabetically by display name
    const nameA = (a.displayName || a.name).toLowerCase();
    const nameB = (b.displayName || b.name).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Format reset time - relative for <24h, absolute date for >=24h (weekly limits)
 */
export function formatResetTime(resetTime: string | null): string | null {
  if (!resetTime) return null;
  try {
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset.getTime() - now.getTime();
    if (diff <= 0) return 'soon';

    const hours = Math.floor(diff / (1000 * 60 * 60));

    // Weekly/long resets: show absolute date (e.g., "01/27, 12:07")
    if (hours >= 24) {
      return reset.toLocaleDateString(undefined, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Daily resets: show relative time
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  } catch {
    return null;
  }
}

/**
 * Get earliest reset time from models array
 */
export function getEarliestResetTime<T extends { resetTime: string | null }>(
  models: T[]
): string | null {
  return models.reduce(
    (earliest, m) => {
      if (!m.resetTime) return earliest;
      if (!earliest) return m.resetTime;
      return new Date(m.resetTime) < new Date(earliest) ? m.resetTime : earliest;
    },
    null as string | null
  );
}

/**
 * Filter to get Claude/GPT models (primary models we care about for quota)
 * These have weekly limits vs Gemini's daily limits
 */
function filterPrimaryModels<T extends { name: string; displayName?: string }>(models: T[]): T[] {
  return models.filter((m) => {
    const name = (m.displayName || m.name || '').toLowerCase();
    return name.includes('claude') || name.includes('gpt');
  });
}

/**
 * Calculate the minimum quota percentage from Claude/GPT models.
 * Returns 0 if Claude/GPT models are missing (exhausted/removed from API response).
 * Only returns null if no models at all.
 */
export function getMinClaudeQuota<
  T extends { name: string; displayName?: string; percentage: number },
>(models: T[]): number | null {
  if (models.length === 0) return null;

  const primaryModels = filterPrimaryModels(models);

  // If no Claude/GPT models in response, they're exhausted (0%)
  if (primaryModels.length === 0) return 0;

  const percentages = primaryModels
    .map((m) => m.percentage)
    .filter((p) => typeof p === 'number' && isFinite(p));

  if (percentages.length === 0) return 0;
  return Math.min(...percentages);
}

/**
 * Get reset time for Claude/GPT models (matches getMinClaudeQuota logic).
 * Falls back to earliest of all models if Claude/GPT not present (still need reset info).
 */
export function getClaudeResetTime<
  T extends { name: string; displayName?: string; resetTime: string | null },
>(models: T[]): string | null {
  if (models.length === 0) return null;

  const primaryModels = filterPrimaryModels(models);
  // Fall back to all models for reset time (we need some reset info even if exhausted)
  const targetModels = primaryModels.length > 0 ? primaryModels : models;

  return targetModels.reduce(
    (earliest, m) => {
      if (!m.resetTime) return earliest;
      if (!earliest) return m.resetTime;
      return new Date(m.resetTime) < new Date(earliest) ? m.resetTime : earliest;
    },
    null as string | null
  );
}

/**
 * Augment models list with synthetic "Exhausted" entry when Claude/GPT models are missing.
 * Used for tooltip display to show user that primary models are exhausted (0%).
 */
export function getModelsWithExhaustedIndicator<
  T extends { name: string; displayName?: string; percentage: number },
>(models: T[]): (T | { name: string; displayName: string; percentage: number })[] {
  if (models.length === 0) return [];

  const primaryModels = filterPrimaryModels(models);

  // If primary models exist, return as-is
  if (primaryModels.length > 0) return models;

  // Primary models exhausted - prepend synthetic entry
  return [
    { name: 'claude-exhausted', displayName: 'Claude/GPT (Exhausted)', percentage: 0 },
    ...models,
  ];
}
