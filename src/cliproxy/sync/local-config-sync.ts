/**
 * Local Config Sync
 *
 * Syncs CCS API profiles to the local CLIProxy config.yaml.
 * Updates only the claude-api-key section, preserving other config.
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { getCliproxyConfigPath } from '../config-generator';
import { generateSyncPayload } from './profile-mapper';
import type { ClaudeKey } from '../management-api-types';

/**
 * Sync profiles to local CLIProxy config.yaml.
 * Merges/replaces the claude-api-key section.
 *
 * @returns Object with success status and synced count
 */
export function syncToLocalConfig(): {
  success: boolean;
  syncedCount: number;
  configPath: string;
  error?: string;
} {
  const configPath = getCliproxyConfigPath();

  try {
    // Generate payload from CCS profiles
    const payload = generateSyncPayload();

    if (payload.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        configPath,
      };
    }

    // Read existing config
    if (!fs.existsSync(configPath)) {
      return {
        success: false,
        syncedCount: 0,
        configPath,
        error: 'CLIProxy config not found. Run ccs doctor to generate.',
      };
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = yaml.load(configContent);

    // Validate config is an object
    if (!parsedConfig || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
      return {
        success: false,
        syncedCount: 0,
        configPath,
        error: 'Invalid config.yaml format. Expected object, got ' + typeof parsedConfig,
      };
    }

    const config = parsedConfig as Record<string, unknown>;

    // Transform payload to config format
    const claudeApiKeys = payload.map(transformToConfigFormat);

    // Update only claude-api-key section
    config['claude-api-key'] = claudeApiKeys;

    // Write back with preserved formatting
    const newContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1, // No wrapping
    });

    // Atomic write with cleanup on failure
    const tempPath = configPath + '.tmp';
    try {
      fs.writeFileSync(tempPath, newContent, { mode: 0o600 });
      fs.renameSync(tempPath, configPath);
    } catch (writeError) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw writeError;
    }

    return {
      success: true,
      syncedCount: payload.length,
      configPath,
    };
  } catch (error) {
    return {
      success: false,
      syncedCount: 0,
      configPath,
      error: (error as Error).message,
    };
  }
}

/**
 * Transform ClaudeKey to config.yaml format.
 * The config format uses slightly different field names.
 */
function transformToConfigFormat(key: ClaudeKey): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    'api-key': key['api-key'],
  };

  if (key['base-url']) {
    entry['base-url'] = key['base-url'];
  }

  // Add empty proxy-url (required by CLIProxyAPI)
  entry['proxy-url'] = '';

  if (key.models && key.models.length > 0) {
    entry.models = key.models.map((m) => ({
      name: m.name,
      alias: m.alias || '',
    }));
  }

  // Note: prefix is not used in local config - it's for remote routing only

  return entry;
}

/**
 * Get local sync status.
 */
export function getLocalSyncStatus(): {
  configExists: boolean;
  configPath: string;
  currentKeyCount: number;
  syncableProfileCount: number;
} {
  const configPath = getCliproxyConfigPath();
  let currentKeyCount = 0;

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content) as Record<string, unknown>;
      const keys = config['claude-api-key'];
      if (Array.isArray(keys)) {
        currentKeyCount = keys.length;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const payload = generateSyncPayload();

  return {
    configExists: fs.existsSync(configPath),
    configPath,
    currentKeyCount,
    syncableProfileCount: payload.length,
  };
}
