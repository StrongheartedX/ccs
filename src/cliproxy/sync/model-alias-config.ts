/**
 * Model Alias Configuration
 *
 * Manages model alias mappings for CLIProxy sync.
 * Aliases map Claude model names to provider-specific models.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../../utils/config-manager';

/** Model alias mapping */
export interface ModelAlias {
  /** Claude model name (e.g., "claude-3-5-sonnet") */
  from: string;
  /** Target model (e.g., "glm-4.7-airx-thinking") */
  to: string;
}

/** Model alias configuration file structure */
export interface ModelAliasConfig {
  /** Version for future schema changes */
  version: number;
  /** Aliases for each profile name */
  aliases: Record<string, ModelAlias[]>;
}

/** Default model aliases (common mappings) */
export const DEFAULT_MODEL_ALIASES: Record<string, ModelAlias[]> = {
  glm: [
    { from: 'claude-sonnet-4-20250514', to: 'glm-4.7-thinking' },
    { from: 'claude-3-5-sonnet-20241022', to: 'glm-4.7' },
    { from: 'claude-3-5-haiku-20241022', to: 'glm-4.7-flash' },
  ],
  kimi: [
    { from: 'claude-sonnet-4-20250514', to: 'moonshot-v1-auto' },
    { from: 'claude-3-5-sonnet-20241022', to: 'moonshot-v1-128k' },
    { from: 'claude-3-5-haiku-20241022', to: 'moonshot-v1-32k' },
  ],
  qwen: [
    { from: 'claude-sonnet-4-20250514', to: 'qwen-coder-plus' },
    { from: 'claude-3-5-sonnet-20241022', to: 'qwen-plus' },
    { from: 'claude-3-5-haiku-20241022', to: 'qwen-turbo' },
  ],
};

/**
 * Get path to model aliases config file.
 */
export function getModelAliasesPath(): string {
  return path.join(getCcsDir(), 'cliproxy', 'model-aliases.json');
}

/**
 * Load model alias configuration.
 * Returns defaults if file doesn't exist.
 */
export function loadModelAliases(): ModelAliasConfig {
  const aliasPath = getModelAliasesPath();

  try {
    if (fs.existsSync(aliasPath)) {
      const content = fs.readFileSync(aliasPath, 'utf8');
      const config = JSON.parse(content) as ModelAliasConfig;
      return config;
    }
  } catch {
    // Fall through to defaults
  }

  // Return defaults
  return {
    version: 1,
    aliases: { ...DEFAULT_MODEL_ALIASES },
  };
}

/**
 * Save model alias configuration.
 * @returns Success status with optional error message
 */
export function saveModelAliases(config: ModelAliasConfig): { success: boolean; error?: string } {
  try {
    const aliasPath = getModelAliasesPath();
    const dir = path.dirname(aliasPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(aliasPath, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get aliases for a specific profile.
 */
export function getProfileAliases(profileName: string): ModelAlias[] {
  const config = loadModelAliases();
  return config.aliases[profileName] ?? [];
}

/**
 * Add an alias for a profile.
 */
export function addProfileAlias(profileName: string, from: string, to: string): void {
  // Validate inputs
  if (!from || from.trim() === '') {
    throw new Error('Model alias "from" cannot be empty');
  }
  if (!to || to.trim() === '') {
    throw new Error('Model alias "to" cannot be empty');
  }

  const config = loadModelAliases();

  if (!config.aliases[profileName]) {
    config.aliases[profileName] = [];
  }

  // Check if alias already exists (update if so)
  const existingIdx = config.aliases[profileName].findIndex((a) => a.from === from);
  if (existingIdx >= 0) {
    config.aliases[profileName][existingIdx].to = to;
  } else {
    config.aliases[profileName].push({ from, to });
  }

  const result = saveModelAliases(config);
  if (!result.success) {
    throw new Error(`Failed to save model aliases: ${result.error}`);
  }
}

/**
 * Remove an alias for a profile.
 */
export function removeProfileAlias(profileName: string, from: string): boolean {
  const config = loadModelAliases();

  if (!config.aliases[profileName]) {
    return false;
  }

  const initialLen = config.aliases[profileName].length;
  config.aliases[profileName] = config.aliases[profileName].filter((a) => a.from !== from);

  if (config.aliases[profileName].length === initialLen) {
    return false;
  }

  // Remove empty profile entry
  if (config.aliases[profileName].length === 0) {
    delete config.aliases[profileName];
  }

  const result = saveModelAliases(config);
  if (!result.success) {
    throw new Error(`Failed to save model aliases: ${result.error}`);
  }
  return true;
}

/**
 * List all aliases.
 */
export function listAllAliases(): Record<string, ModelAlias[]> {
  const config = loadModelAliases();
  return config.aliases;
}
