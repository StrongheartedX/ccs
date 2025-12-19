/**
 * OAuth Process Execution for CLIProxyAPI
 *
 * Handles the spawning and monitoring of CLIProxy OAuth process.
 * Separated from oauth-handler.ts for modularity.
 */

import { spawn, ChildProcess } from 'child_process';
import { ok, fail, info } from '../../utils/ui';
import { CLIProxyProvider } from '../types';
import { AccountInfo } from '../account-manager';
import {
  parseProjectList,
  parseDefaultProject,
  isProjectSelectionPrompt,
  isProjectList,
  generateSessionId,
  requestProjectSelection,
  type GCloudProject,
  type ProjectSelectionPrompt,
} from '../project-selection-handler';
import { ProviderOAuthConfig } from './auth-types';
import { getTimeoutTroubleshooting, showStep } from './environment-detector';
import { isAuthenticated, registerAccountFromToken } from './token-manager';

/** Options for OAuth process execution */
export interface OAuthProcessOptions {
  provider: CLIProxyProvider;
  binaryPath: string;
  args: string[];
  tokenDir: string;
  oauthConfig: ProviderOAuthConfig;
  callbackPort: number | null;
  headless: boolean;
  verbose: boolean;
  isCLI: boolean;
  nickname?: string;
}

/** Internal state for OAuth process */
interface ProcessState {
  stderrData: string;
  urlDisplayed: boolean;
  browserOpened: boolean;
  projectPromptHandled: boolean;
  accumulatedOutput: string;
  parsedProjects: GCloudProject[];
  sessionId: string;
}

/**
 * Handle project selection prompt
 */
async function handleProjectSelection(
  output: string,
  state: ProcessState,
  options: OAuthProcessOptions,
  authProcess: ChildProcess,
  log: (msg: string) => void
): Promise<void> {
  const defaultProjectId = parseDefaultProject(output) || '';

  if (state.parsedProjects.length > 0 && !options.isCLI) {
    log(`Requesting project selection from UI (session: ${state.sessionId})`);

    const prompt: ProjectSelectionPrompt = {
      sessionId: state.sessionId,
      provider: options.provider,
      projects: state.parsedProjects,
      defaultProjectId,
      supportsAll: output.includes('ALL'),
    };

    try {
      const selectedId = await requestProjectSelection(prompt);
      const response = selectedId || '';
      log(`User selected: ${response || '(default)'}`);
      authProcess.stdin?.write(response + '\n');
    } catch {
      log('Project selection failed, using default');
      authProcess.stdin?.write('\n');
    }
  } else {
    log('CLI mode or no projects, auto-selecting default');
    authProcess.stdin?.write('\n');
  }
}

/**
 * Handle stdout data from OAuth process
 */
async function handleStdout(
  output: string,
  state: ProcessState,
  options: OAuthProcessOptions,
  authProcess: ChildProcess,
  log: (msg: string) => void
): Promise<void> {
  log(`stdout: ${output.trim()}`);
  state.accumulatedOutput += output;

  // Parse project list when available
  if (isProjectList(state.accumulatedOutput) && state.parsedProjects.length === 0) {
    state.parsedProjects = parseProjectList(state.accumulatedOutput);
    log(`Parsed ${state.parsedProjects.length} projects`);
  }

  // Handle project selection prompt
  if (!state.projectPromptHandled && isProjectSelectionPrompt(output)) {
    state.projectPromptHandled = true;
    await handleProjectSelection(output, state, options, authProcess, log);
  }

  // Detect callback server / browser
  if (!state.browserOpened && (output.includes('listening') || output.includes('http'))) {
    process.stdout.write('\x1b[1A\x1b[2K');
    showStep(2, 4, 'ok', `Callback server listening on port ${options.callbackPort}`);
    showStep(3, 4, 'progress', 'Opening browser...');
    state.browserOpened = true;
  }

  // Display OAuth URLs in headless mode
  if (options.headless && !state.urlDisplayed) {
    const urlMatch = output.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      console.log('');
      console.log(info(`${options.oauthConfig.displayName} OAuth URL:`));
      console.log(`    ${urlMatch[0]}`);
      console.log('');
      state.urlDisplayed = true;
    }
  }
}

/** Display OAuth URL from stderr if in headless mode */
function displayUrlFromStderr(
  output: string,
  state: ProcessState,
  oauthConfig: ProviderOAuthConfig
): void {
  const urlMatch = output.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    console.log('');
    console.log(info(`${oauthConfig.displayName} OAuth URL:`));
    console.log(`    ${urlMatch[0]}`);
    console.log('');
    state.urlDisplayed = true;
  }
}

/** Handle token not found after successful process exit */
function handleTokenNotFound(provider: CLIProxyProvider, callbackPort: number | null): void {
  console.log('');
  console.log(fail('Token not found after authentication'));
  console.log('');
  console.log('The browser showed success but callback was not received.');

  if (process.platform === 'win32') {
    console.log('');
    console.log('On Windows, this usually means:');
    console.log('  1. Windows Firewall blocked the callback');
    console.log('  2. Antivirus software blocked the connection');
    console.log('');
    console.log('Try running as Administrator:');
    console.log(
      `  netsh advfirewall firewall add rule name="CCS OAuth" dir=in action=allow protocol=TCP localport=${callbackPort}`
    );
  }

  console.log('');
  console.log(`Try: ccs ${provider} --auth --verbose`);
}

/** Handle process exit with error */
function handleProcessError(code: number | null, state: ProcessState, headless: boolean): void {
  console.log('');
  console.log(fail(`CLIProxyAPI auth exited with code ${code}`));
  if (state.stderrData && !state.urlDisplayed) {
    console.log(`    ${state.stderrData.trim().split('\n')[0]}`);
  }
  if (headless && !state.urlDisplayed) {
    console.log('');
    console.log(info('No OAuth URL was displayed. Try with --verbose for details.'));
  }
}

/**
 * Execute OAuth process and wait for completion
 */
export function executeOAuthProcess(options: OAuthProcessOptions): Promise<AccountInfo | null> {
  const {
    provider,
    binaryPath,
    args,
    tokenDir,
    oauthConfig,
    callbackPort,
    headless,
    verbose,
    nickname,
  } = options;

  const log = (msg: string) => {
    if (verbose) console.error(`[auth] ${msg}`);
  };

  return new Promise<AccountInfo | null>((resolve) => {
    const authProcess = spawn(binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLI_PROXY_AUTH_DIR: tokenDir },
    });

    const state: ProcessState = {
      stderrData: '',
      urlDisplayed: false,
      browserOpened: false,
      projectPromptHandled: false,
      accumulatedOutput: '',
      parsedProjects: [],
      sessionId: generateSessionId(),
    };

    const startTime = Date.now();

    authProcess.stdout?.on('data', async (data: Buffer) => {
      await handleStdout(data.toString(), state, options, authProcess, log);
    });

    authProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      state.stderrData += output;
      log(`stderr: ${output.trim()}`);
      if (headless && !state.urlDisplayed) {
        displayUrlFromStderr(output, state, oauthConfig);
      }
    });

    // Show waiting message after delay
    setTimeout(() => {
      if (!state.browserOpened) {
        process.stdout.write('\x1b[1A\x1b[2K');
        showStep(2, 4, 'ok', `Callback server ready (port ${callbackPort})`);
        showStep(3, 4, 'ok', 'Browser opened');
        state.browserOpened = true;
      }
      showStep(4, 4, 'progress', 'Waiting for OAuth callback...');
      console.log('');
      console.log(info('Complete the login in your browser. This page will update automatically.'));
      if (!verbose) console.log(info('If stuck, try: ccs ' + provider + ' --auth --verbose'));
    }, 2000);

    // Timeout handling
    const timeoutMs = headless ? 300000 : 120000;
    const timeout = setTimeout(() => {
      authProcess.kill();
      console.log('');
      console.log(fail(`OAuth timed out after ${headless ? 5 : 2} minutes`));
      for (const line of getTimeoutTroubleshooting(provider, callbackPort ?? null)) {
        console.log(line);
      }
      resolve(null);
    }, timeoutMs);

    authProcess.on('exit', (code) => {
      clearTimeout(timeout);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        if (isAuthenticated(provider)) {
          console.log('');
          console.log(ok(`Authentication successful (${elapsed}s)`));
          resolve(registerAccountFromToken(provider, tokenDir, nickname));
        } else {
          handleTokenNotFound(provider, callbackPort);
          resolve(null);
        }
      } else {
        handleProcessError(code, state, headless);
        resolve(null);
      }
    });

    authProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.log('');
      console.log(fail(`Failed to start auth process: ${error.message}`));
      resolve(null);
    });
  });
}
