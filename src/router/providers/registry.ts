import type { ResolvedProvider, ApiProviderConfig } from './types';
import { loadRouterConfig } from '../config/loader';
import { loadUnifiedConfig } from '../../config/unified-config-loader';
import { readFileSync, existsSync } from 'node:fs';
import { expandPath } from '../../utils/helpers';

// Hardcoded CLIProxy providers (auto-discovered)
const CLIPROXY_PROVIDER_LIST = ['agy', 'gemini', 'codex', 'qwen', 'iflow', 'kiro', 'ghcp'] as const;

// CLIProxyAPI base URL
const CLIPROXY_BASE_URL = 'http://127.0.0.1:8317';

/**
 * Get provider by name
 * Priority: 1. CLIProxy hardcoded, 2. Settings profiles, 3. API providers from router config
 */
export async function getProvider(name: string): Promise<ResolvedProvider | null> {
  // Check CLIProxy providers first
  if (isCLIProxyProvider(name)) {
    return resolveCLIProxyProvider(name);
  }

  // Check settings-based profiles (glm, glmt, kimi, etc.)
  const settingsProvider = resolveSettingsProfile(name);
  if (settingsProvider) {
    return settingsProvider;
  }

  // Check API providers from router config
  const config = loadRouterConfig();
  const apiConfig = config?.providers?.[name];

  if (apiConfig) {
    return resolveApiProvider(name, apiConfig);
  }

  return null;
}

/**
 * Check if name is a hardcoded CLIProxy provider
 */
export function isCLIProxyProvider(name: string): boolean {
  return CLIPROXY_PROVIDER_LIST.includes(name as (typeof CLIPROXY_PROVIDER_LIST)[number]);
}

/**
 * Resolve CLIProxy provider
 */
function resolveCLIProxyProvider(name: string): ResolvedProvider {
  return {
    name,
    type: 'cliproxy',
    adapter: 'anthropic', // CLIProxy speaks Anthropic format
    baseUrl: `${CLIPROXY_BASE_URL}/api/provider/${name}/v1`,
  };
}

/**
 * Resolve settings-based profile (glm, glmt, kimi, etc.)
 * Reads env vars from the profile's settings.json file
 */
function resolveSettingsProfile(name: string): ResolvedProvider | null {
  const unifiedConfig = loadUnifiedConfig();
  const profileConfig = unifiedConfig?.profiles?.[name];

  if (!profileConfig) return null;

  // Read settings file to get env vars
  const settingsPath = expandPath(profileConfig.settings);
  if (!existsSync(settingsPath)) return null;

  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const env = settings.env || {};

    return {
      name,
      type: 'settings',
      adapter: 'anthropic', // Settings profiles use Anthropic format
      baseUrl: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      authToken: env.ANTHROPIC_AUTH_TOKEN,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve API provider from router config
 */
function resolveApiProvider(name: string, config: ApiProviderConfig): ResolvedProvider {
  const authToken = process.env[config.auth_env];

  return {
    name,
    type: 'api',
    adapter: config.adapter,
    baseUrl: config.base_url,
    authToken,
    headers: config.headers,
  };
}

/**
 * Check if name is a settings-based profile
 */
export function isSettingsProfile(name: string): boolean {
  const unifiedConfig = loadUnifiedConfig();
  return !!unifiedConfig?.profiles?.[name];
}

/**
 * List all available providers
 */
export async function listProviders(): Promise<{
  cliproxy: string[];
  settings: string[];
  api: string[];
}> {
  const routerConfig = loadRouterConfig();
  const unifiedConfig = loadUnifiedConfig();

  return {
    cliproxy: [...CLIPROXY_PROVIDER_LIST],
    settings: unifiedConfig?.profiles ? Object.keys(unifiedConfig.profiles) : [],
    api: routerConfig?.providers ? Object.keys(routerConfig.providers) : [],
  };
}

/**
 * Get all providers as resolved list
 */
export async function getAllProviders(): Promise<ResolvedProvider[]> {
  const providers: ResolvedProvider[] = [];

  // Add CLIProxy providers
  for (const name of CLIPROXY_PROVIDER_LIST) {
    providers.push(resolveCLIProxyProvider(name));
  }

  // Add settings-based profiles (glm, glmt, kimi, etc.)
  const unifiedConfig = loadUnifiedConfig();
  if (unifiedConfig?.profiles) {
    for (const name of Object.keys(unifiedConfig.profiles)) {
      const resolved = resolveSettingsProfile(name);
      if (resolved) providers.push(resolved);
    }
  }

  // Add API providers from router config
  const routerConfig = loadRouterConfig();
  if (routerConfig?.providers) {
    for (const [name, apiConfig] of Object.entries(routerConfig.providers)) {
      providers.push(resolveApiProvider(name, apiConfig));
    }
  }

  return providers;
}
