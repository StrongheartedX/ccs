import type { ResolvedProvider, ProviderHealthResult } from './types';
import { getAuthStatus } from '../../cliproxy/auth/token-manager';
import { getPortProcess, isCLIProxyProcess } from '../../utils/port-utils';
import { CLIPROXY_DEFAULT_PORT } from '../../cliproxy';
import type { CLIProxyProvider } from '../../cliproxy/types';

// Health check cache (TTL-based)
const healthCache = new Map<string, ProviderHealthResult>();
const CACHE_TTL = 30 * 1000; // 30 seconds

// CLIProxy port status cache (shared across all CLIProxy providers)
let cliproxyPortHealthy: boolean | null = null;
let cliproxyPortCheckedAt: Date | null = null;

/**
 * Check provider health
 * Uses cached result if fresh, otherwise performs live check
 */
export async function checkProviderHealth(
  provider: ResolvedProvider
): Promise<ProviderHealthResult> {
  // Check cache
  const cached = healthCache.get(provider.name);
  if (cached && Date.now() - cached.checkedAt.getTime() < CACHE_TTL) {
    return cached;
  }

  // Perform live check based on provider type
  const result =
    provider.type === 'cliproxy'
      ? await checkCLIProxyProviderHealth(provider)
      : await checkApiProviderHealth(provider);

  healthCache.set(provider.name, result);
  return result;
}

/**
 * Check CLIProxy provider health using CCS's native auth status
 * CLIProxy health = port running + OAuth token valid
 */
async function checkCLIProxyProviderHealth(
  provider: ResolvedProvider
): Promise<ProviderHealthResult> {
  const startTime = Date.now();

  // Check if CLIProxy port is running (cached check)
  if (
    cliproxyPortHealthy === null ||
    !cliproxyPortCheckedAt ||
    Date.now() - cliproxyPortCheckedAt.getTime() > CACHE_TTL
  ) {
    const portProcess = await getPortProcess(CLIPROXY_DEFAULT_PORT);
    cliproxyPortHealthy = portProcess !== null && isCLIProxyProcess(portProcess);
    cliproxyPortCheckedAt = new Date();
  }

  const latency = Date.now() - startTime;

  // Check OAuth status for this provider
  const authStatus = getAuthStatus(provider.name as CLIProxyProvider);

  if (!cliproxyPortHealthy) {
    return {
      provider: provider.name,
      healthy: false,
      latency,
      error: 'CLIProxy not running',
      checkedAt: new Date(),
    };
  }

  if (!authStatus.authenticated) {
    return {
      provider: provider.name,
      healthy: false,
      latency,
      error: 'Not authenticated',
      checkedAt: new Date(),
    };
  }

  return {
    provider: provider.name,
    healthy: true,
    latency,
    checkedAt: new Date(),
  };
}

/**
 * Check API provider health via HTTP endpoint
 */
async function checkApiProviderHealth(provider: ResolvedProvider): Promise<ProviderHealthResult> {
  const startTime = Date.now();

  try {
    const endpoint = `${provider.baseUrl}/models`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: provider.authToken ? `Bearer ${provider.authToken}` : '',
        ...provider.headers,
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        provider: provider.name,
        healthy: true,
        latency,
        checkedAt: new Date(),
      };
    }

    return {
      provider: provider.name,
      healthy: false,
      latency,
      error: `HTTP ${response.status}: ${response.statusText}`,
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      provider: provider.name,
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date(),
    };
  }
}

/**
 * Check health of all configured providers
 */
export async function checkAllProvidersHealth(
  providers: ResolvedProvider[]
): Promise<ProviderHealthResult[]> {
  return Promise.all(providers.map(checkProviderHealth));
}

/**
 * Force refresh health cache for provider
 */
export function invalidateHealthCache(providerName?: string): void {
  if (providerName) {
    healthCache.delete(providerName);
  } else {
    healthCache.clear();
    // Also reset CLIProxy port cache
    cliproxyPortHealthy = null;
    cliproxyPortCheckedAt = null;
  }
}

/**
 * Get health check cache stats
 */
export function getHealthCacheStats(): {
  size: number;
  entries: { provider: string; healthy: boolean; age: number }[];
} {
  const now = Date.now();
  return {
    size: healthCache.size,
    entries: Array.from(healthCache.entries()).map(([name, result]) => ({
      provider: name,
      healthy: result.healthy,
      age: now - result.checkedAt.getTime(),
    })),
  };
}
