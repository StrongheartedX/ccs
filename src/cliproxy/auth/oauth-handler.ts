/**
 * OAuth Handler for CLIProxyAPI
 *
 * Manages OAuth authentication flow for CLIProxy providers (Gemini, Codex, Antigravity).
 * CLIProxyAPI handles OAuth internally - we just need to:
 * 1. Check if auth exists (token files in CCS auth directory)
 * 2. Trigger OAuth flow by spawning binary with auth flag
 * 3. Auto-detect headless environments (SSH, no DISPLAY)
 * 4. Use --no-browser flag for headless, display OAuth URL for manual auth
 */

import * as fs from 'fs';
import { fail, info, warn, color } from '../../utils/ui';
import { ensureCLIProxyBinary } from '../binary-manager';
import { generateConfig } from '../config-generator';
import { CLIProxyProvider } from '../types';
import {
  AccountInfo,
  getProviderAccounts,
  getDefaultAccount,
  touchAccount,
} from '../account-manager';
import {
  enhancedPreflightOAuthCheck,
  OAUTH_CALLBACK_PORTS as OAUTH_PORTS,
} from '../../management/oauth-port-diagnostics';
import { OAuthOptions, OAUTH_CALLBACK_PORTS, getOAuthConfig } from './auth-types';
import { isHeadlessEnvironment, killProcessOnPort, showStep } from './environment-detector';
import { getProviderTokenDir, isAuthenticated } from './token-manager';
import { executeOAuthProcess } from './oauth-process';

/**
 * Prompt user to add another account
 */
async function promptAddAccount(): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question('[?] Add another account? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Run pre-flight OAuth checks
 */
async function runPreflightChecks(
  provider: CLIProxyProvider,
  oauthConfig: { displayName: string }
): Promise<boolean> {
  console.log('');
  console.log(info(`Pre-flight OAuth check for ${oauthConfig.displayName}...`));

  const preflight = await enhancedPreflightOAuthCheck(provider);

  for (const check of preflight.checks) {
    const icon = check.status === 'ok' ? '[OK]' : check.status === 'warn' ? '[!]' : '[X]';
    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (check.fixCommand && check.status !== 'ok') {
      console.log(`      Fix: ${check.fixCommand}`);
    }
  }

  if (preflight.firewallWarning) {
    console.log('');
    console.log(warn('Windows Firewall may block OAuth callback'));
    console.log('    If auth hangs, run as Administrator:');
    console.log(`    ${color(preflight.firewallFixCommand || '', 'command')}`);
  }

  if (!preflight.ready) {
    console.log('');
    console.log(fail('Pre-flight check failed. Resolve issues above and retry.'));
    return false;
  }

  return true;
}

/**
 * Prepare OAuth binary and config
 */
async function prepareBinary(
  provider: CLIProxyProvider,
  verbose: boolean
): Promise<{ binaryPath: string; tokenDir: string; configPath: string } | null> {
  showStep(1, 4, 'progress', 'Preparing CLIProxy binary...');

  try {
    const binaryPath = await ensureCLIProxyBinary(verbose);
    process.stdout.write('\x1b[1A\x1b[2K');
    showStep(1, 4, 'ok', 'CLIProxy binary ready');

    const tokenDir = getProviderTokenDir(provider);
    fs.mkdirSync(tokenDir, { recursive: true, mode: 0o700 });

    const configPath = generateConfig(provider);
    if (verbose) {
      console.error(`[auth] Config generated: ${configPath}`);
    }

    return { binaryPath, tokenDir, configPath };
  } catch (error) {
    process.stdout.write('\x1b[1A\x1b[2K');
    showStep(1, 4, 'fail', 'Failed to prepare CLIProxy binary');
    console.error(fail((error as Error).message));
    throw error;
  }
}

/**
 * Trigger OAuth flow for provider
 * Auto-detects headless environment and uses --no-browser flag accordingly
 * Shows real-time step-by-step progress for better user feedback
 */
export async function triggerOAuth(
  provider: CLIProxyProvider,
  options: OAuthOptions = {}
): Promise<AccountInfo | null> {
  const oauthConfig = getOAuthConfig(provider);
  const { verbose = false, add = false, nickname, fromUI = false } = options;
  const callbackPort = OAUTH_PORTS[provider];
  const isCLI = !fromUI;
  const headless = options.headless ?? isHeadlessEnvironment();

  // Check for existing accounts
  const existingAccounts = getProviderAccounts(provider);
  if (existingAccounts.length > 0 && !add) {
    console.log('');
    console.log(
      info(
        `${existingAccounts.length} account(s) already authenticated for ${oauthConfig.displayName}`
      )
    );

    if (!(await promptAddAccount())) {
      console.log(info('Cancelled'));
      return null;
    }
  }

  // Pre-flight checks
  if (!(await runPreflightChecks(provider, oauthConfig))) {
    return null;
  }

  console.log('');

  // Prepare binary
  const prepared = await prepareBinary(provider, verbose);
  if (!prepared) return null;

  const { binaryPath, tokenDir, configPath } = prepared;

  // Free callback port if needed
  const localCallbackPort = OAUTH_CALLBACK_PORTS[provider];
  if (localCallbackPort) {
    const killed = killProcessOnPort(localCallbackPort, verbose);
    if (killed && verbose) {
      console.error(`[auth] Freed port ${localCallbackPort} for OAuth callback`);
    }
  }

  // Build args
  const args = ['--config', configPath, oauthConfig.authFlag];
  if (headless) {
    args.push('--no-browser');
  }

  // Show callback server step
  showStep(2, 4, 'progress', `Starting callback server on port ${callbackPort || 'N/A'}...`);

  // Show headless instructions
  if (headless) {
    console.log('');
    console.log(warn('PORT FORWARDING REQUIRED'));
    console.log(`    OAuth callback uses localhost:${callbackPort} which must be reachable.`);
    console.log('    Run this on your LOCAL machine:');
    console.log(
      `    ${color(`ssh -L ${callbackPort}:localhost:${callbackPort} <USER>@<HOST>`, 'command')}`
    );
    console.log('');
  }

  // Execute OAuth process
  return executeOAuthProcess({
    provider,
    binaryPath,
    args,
    tokenDir,
    oauthConfig,
    callbackPort,
    headless,
    verbose,
    isCLI,
    nickname,
  });
}

/**
 * Ensure provider is authenticated
 * Triggers OAuth flow if not authenticated
 */
export async function ensureAuth(
  provider: CLIProxyProvider,
  options: { verbose?: boolean; headless?: boolean; account?: string } = {}
): Promise<boolean> {
  if (isAuthenticated(provider)) {
    if (options.verbose) {
      console.error(`[auth] ${provider} already authenticated`);
    }
    const defaultAccount = getDefaultAccount(provider);
    if (defaultAccount) {
      touchAccount(provider, options.account || defaultAccount.id);
    }
    return true;
  }

  const oauthConfig = getOAuthConfig(provider);
  console.log(info(`${oauthConfig.displayName} authentication required`));

  const account = await triggerOAuth(provider, options);
  return account !== null;
}
