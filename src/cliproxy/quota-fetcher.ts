/**
 * Quota Fetcher for Antigravity Accounts
 *
 * Fetches quota information from Google Cloud Code internal API.
 * Used for displaying remaining quota percentages and reset times.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAuthDir } from './config-generator';
import { CLIProxyProvider } from './types';

/** Individual model quota info */
export interface ModelQuota {
  /** Model name, e.g., "gemini-3-pro-high" */
  name: string;
  /** Display name from API, e.g., "Gemini 3 Pro" */
  displayName?: string;
  /** Remaining quota as percentage (0-100) */
  percentage: number;
  /** ISO timestamp when quota resets, null if unknown */
  resetTime: string | null;
}

/** Quota fetch result */
export interface QuotaResult {
  /** Whether fetch succeeded */
  success: boolean;
  /** Quota for each available model */
  models: ModelQuota[];
  /** Timestamp of fetch */
  lastUpdated: number;
  /** True if account lacks quota access (403) */
  isForbidden?: boolean;
  /** Error message if fetch failed */
  error?: string;
  /** True if token is expired and needs re-auth */
  isExpired?: boolean;
  /** ISO timestamp when token expires/expired */
  expiresAt?: string;
}

/** Google Cloud Code API endpoints */
const ANTIGRAVITY_API_BASE = 'https://cloudcode-pa.googleapis.com';
const ANTIGRAVITY_API_VERSION = 'v1internal';

/** Google OAuth token endpoint */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Antigravity OAuth credentials (from CLIProxyAPIPlus - public in open-source code) */
const ANTIGRAVITY_CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';

/** API client headers */
const ANTIGRAVITY_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'antigravity/1.11.5 linux/amd64',
  'X-Goog-Api-Client': 'gl-node/20.9.0',
};

/** Auth file structure */
interface AntigravityAuthFile {
  access_token: string;
  refresh_token?: string;
  email?: string;
  expired?: string;
  expires_in?: number;
  timestamp?: number;
  type?: string;
  project_id?: string;
}

/** Auth data returned from file */
interface AuthData {
  accessToken: string;
  refreshToken: string | null;
  projectId: string | null;
  isExpired: boolean;
  expiresAt: string | null;
}

/** Token refresh response */
interface TokenRefreshResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** loadCodeAssist response */
interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
}

/** fetchAvailableModels response model */
interface AvailableModel {
  name?: string;
  displayName?: string;
  quotaInfo?: {
    remainingFraction?: number;
    remaining_fraction?: number;
    remaining?: number;
    resetTime?: string;
    reset_time?: string;
  };
  quota_info?: {
    remainingFraction?: number;
    remaining_fraction?: number;
    remaining?: number;
    resetTime?: string;
    reset_time?: string;
  };
}

/** fetchAvailableModels response */
interface FetchAvailableModelsResponse {
  models?: Record<string, AvailableModel>;
}

/**
 * Sanitize email to match CLIProxyAPI auth file naming convention
 * Replaces @ and . with underscores (matches Go sanitizeAntigravityFileName)
 */
function sanitizeEmail(email: string): string {
  return email.replace(/@/g, '_').replace(/\./g, '_');
}

/**
 * Check if token is expired based on the expired timestamp
 */
function isTokenExpired(expiredStr?: string): boolean {
  if (!expiredStr) return false;
  try {
    const expiredDate = new Date(expiredStr);
    return expiredDate.getTime() < Date.now();
  } catch {
    return false;
  }
}

/**
 * Refresh access token using refresh_token via Google OAuth
 * This allows CCS to get fresh tokens independently of CLIProxyAPI
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string | null; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: ANTIGRAVITY_CLIENT_ID,
        client_secret: ANTIGRAVITY_CLIENT_SECRET,
      }).toString(),
    });

    clearTimeout(timeoutId);

    const data = (await response.json()) as TokenRefreshResponse;

    if (!response.ok || data.error) {
      return {
        accessToken: null,
        error: data.error_description || data.error || `OAuth error: ${response.status}`,
      };
    }

    if (!data.access_token) {
      return { accessToken: null, error: 'No access_token in response' };
    }

    return { accessToken: data.access_token };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { accessToken: null, error: 'Token refresh timeout' };
    }
    return { accessToken: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Read auth data from auth file (access token, project_id, expiry status)
 */
function readAuthData(provider: CLIProxyProvider, accountId: string): AuthData | null {
  const authDir = getAuthDir();

  // Check if auth directory exists
  if (!fs.existsSync(authDir)) {
    return null;
  }

  // Sanitize accountId (email) to match auth file naming: @ and . → _
  const sanitizedId = sanitizeEmail(accountId);
  const prefix = provider === 'agy' ? 'antigravity-' : `${provider}-`;
  const expectedFile = `${prefix}${sanitizedId}.json`;
  const filePath = path.join(authDir, expectedFile);

  // Direct file access (most common case)
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as AntigravityAuthFile;
      if (!data.access_token) return null;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        projectId: data.project_id || null,
        isExpired: isTokenExpired(data.expired),
        expiresAt: data.expired || null,
      };
    } catch {
      return null;
    }
  }

  // Fallback: scan directory for matching email in file content
  const files = fs.readdirSync(authDir);
  for (const file of files) {
    if (file.startsWith(prefix) && file.endsWith('.json')) {
      const candidatePath = path.join(authDir, file);
      try {
        const content = fs.readFileSync(candidatePath, 'utf-8');
        const data = JSON.parse(content) as AntigravityAuthFile;
        // Match by email field inside the auth file
        if (data.email === accountId && data.access_token) {
          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || null,
            projectId: data.project_id || null,
            isExpired: isTokenExpired(data.expired),
            expiresAt: data.expired || null,
          };
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Get project ID via loadCodeAssist endpoint
 */
async function getProjectId(
  accessToken: string
): Promise<{ projectId: string | null; error?: string }> {
  const url = `${ANTIGRAVITY_API_BASE}/${ANTIGRAVITY_API_VERSION}:loadCodeAssist`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...ANTIGRAVITY_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        metadata: {
          ideType: 'IDE_UNSPECIFIED',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI',
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Return specific error based on status
      if (response.status === 401) {
        return { projectId: null, error: 'Token expired or invalid' };
      }
      if (response.status === 403) {
        return { projectId: null, error: 'Access forbidden' };
      }
      return { projectId: null, error: `API error: ${response.status}` };
    }

    const data = (await response.json()) as LoadCodeAssistResponse;

    // Extract project ID from response
    let projectId: string | undefined;
    if (typeof data.cloudaicompanionProject === 'string') {
      projectId = data.cloudaicompanionProject;
    } else if (typeof data.cloudaicompanionProject === 'object') {
      projectId = data.cloudaicompanionProject?.id;
    }

    if (!projectId?.trim()) {
      return { projectId: null, error: 'No project ID in response' };
    }

    return { projectId: projectId.trim() };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      return { projectId: null, error: 'Request timeout' };
    }
    return { projectId: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Fetch available models with quota info
 */
async function fetchAvailableModels(accessToken: string, projectId: string): Promise<QuotaResult> {
  const url = `${ANTIGRAVITY_API_BASE}/${ANTIGRAVITY_API_VERSION}:fetchAvailableModels`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...ANTIGRAVITY_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        project: projectId,
      }),
    });

    clearTimeout(timeoutId);

    if (response.status === 403) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        isForbidden: true,
        error: 'Quota access forbidden for this account',
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        error: 'Access token expired or invalid',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        models: [],
        lastUpdated: Date.now(),
        error: `API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as FetchAvailableModelsResponse;
    const models: ModelQuota[] = [];

    if (data.models && typeof data.models === 'object') {
      for (const [modelId, modelData] of Object.entries(data.models)) {
        const quotaInfo = modelData.quotaInfo || modelData.quota_info;
        if (!quotaInfo) continue;

        // Extract remaining fraction (0-1 range)
        const remaining =
          quotaInfo.remainingFraction ?? quotaInfo.remaining_fraction ?? quotaInfo.remaining;

        // Skip invalid values (NaN, Infinity, non-numbers)
        if (typeof remaining !== 'number' || !isFinite(remaining)) continue;

        // Convert to percentage (0-100) and clamp to valid range
        const percentage = Math.max(0, Math.min(100, Math.round(remaining * 100)));

        // Extract reset time
        const resetTime = quotaInfo.resetTime || quotaInfo.reset_time || null;

        models.push({
          name: modelId,
          displayName: modelData.displayName,
          percentage,
          resetTime,
        });
      }
    }

    return {
      success: true,
      models,
      lastUpdated: Date.now(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Fetch quota for an Antigravity account
 *
 * @param provider - Provider name (only 'agy' supported)
 * @param accountId - Account identifier (email)
 * @returns Quota result with models and percentages
 */
export async function fetchAccountQuota(
  provider: CLIProxyProvider,
  accountId: string
): Promise<QuotaResult> {
  // Only Antigravity supports quota fetching
  if (provider !== 'agy') {
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: `Quota not supported for provider: ${provider}`,
    };
  }

  // Read auth data from auth file
  const authData = readAuthData(provider, accountId);
  if (!authData) {
    return {
      success: false,
      models: [],
      lastUpdated: Date.now(),
      error: 'Auth file not found for account',
    };
  }

  // Determine which access token to use
  // File-based token is often stale (CLIProxyAPIPlus refreshes at runtime but doesn't persist)
  // If we have refresh_token, proactively refresh to get a fresh access_token
  let accessToken = authData.accessToken;

  if (authData.refreshToken) {
    // Always refresh to ensure we have a valid token
    // This is necessary because CLIProxyAPIPlus doesn't persist refreshed tokens
    const refreshResult = await refreshAccessToken(authData.refreshToken);
    if (refreshResult.accessToken) {
      accessToken = refreshResult.accessToken;
    }
    // If refresh fails, fall back to existing token (might still work)
  }

  // Get project ID - prefer stored value, fallback to API call
  let projectId = authData.projectId;
  if (!projectId) {
    const projectResult = await getProjectId(accessToken);
    if (!projectResult.projectId) {
      // If project ID fetch fails, it might be token issue - try refresh if we haven't
      if (authData.refreshToken && accessToken === authData.accessToken) {
        const refreshResult = await refreshAccessToken(authData.refreshToken);
        if (refreshResult.accessToken) {
          accessToken = refreshResult.accessToken;
          const retryResult = await getProjectId(accessToken);
          if (retryResult.projectId) {
            projectId = retryResult.projectId;
          }
        }
      }
      if (!projectId) {
        return {
          success: false,
          models: [],
          lastUpdated: Date.now(),
          error: projectResult.error || 'Failed to retrieve project ID',
        };
      }
    } else {
      projectId = projectResult.projectId;
    }
  }

  // Fetch models with quota
  const result = await fetchAvailableModels(accessToken, projectId);

  // If quota fetch fails with auth error and we haven't refreshed yet, try refresh
  if (!result.success && result.error?.includes('expired') && authData.refreshToken) {
    const refreshResult = await refreshAccessToken(authData.refreshToken);
    if (refreshResult.accessToken) {
      return fetchAvailableModels(refreshResult.accessToken, projectId);
    }
  }

  return result;
}
