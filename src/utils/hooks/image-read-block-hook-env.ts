/**
 * Image Read Block Hook Environment Variables
 *
 * Provides environment variables for image read blocking hook configuration.
 * Prevents context overflow when skills generate images and agent tries to read them.
 *
 * @module utils/hooks/image-read-block-hook-env
 */

import { loadOrCreateUnifiedConfig } from '../../config/unified-config-loader';

/**
 * Configuration for image read blocking.
 */
export interface ImageReadBlockConfig {
  /** Whether blocking is enabled */
  enabled: boolean;
}

/**
 * Get image read block configuration from unified config.
 * Defaults to disabled (opt-in feature).
 */
export function getImageReadBlockConfig(): ImageReadBlockConfig {
  const config = loadOrCreateUnifiedConfig();
  // Access hooks config via type assertion since it's a new field not yet in UnifiedConfig type
  const hooksConfig = (
    config as unknown as { hooks?: { block_image_read?: { enabled?: boolean } } }
  ).hooks;
  return {
    // Default to false - must be explicitly enabled
    enabled: hooksConfig?.block_image_read?.enabled ?? false,
  };
}

/**
 * Get environment variables for image read block hook configuration.
 *
 * @returns Record of environment variables to set before spawning Claude
 */
export function getImageReadBlockHookEnv(): Record<string, string> {
  const config = getImageReadBlockConfig();
  const env: Record<string, string> = {};

  if (config.enabled) {
    env.CCS_BLOCK_IMAGE_READ = '1';
  }

  return env;
}
