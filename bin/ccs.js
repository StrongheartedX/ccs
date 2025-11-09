#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { error, colored } = require('./helpers');
const { detectClaudeCli, showClaudeNotFoundError } = require('./claude-detector');
const { getSettingsPath, getConfigPath } = require('./config-manager');

// Version (sync with package.json)
const CCS_VERSION = require('../package.json').version;

// Helper: Escape arguments for shell execution
function escapeShellArg(arg) {
  // Windows: escape double quotes and wrap in double quotes
  return '"' + String(arg).replace(/"/g, '""') + '"';
}

// Execute Claude CLI with unified spawn logic
function execClaude(claudeCli, args, envVars = null) {
  const isWindows = process.platform === 'win32';
  const needsShell = isWindows && /\.(cmd|bat|ps1)$/i.test(claudeCli);

  // Prepare environment (merge with process.env if envVars provided)
  const env = envVars ? { ...process.env, ...envVars } : process.env;

  let child;
  if (needsShell) {
    // When shell needed: concatenate into string to avoid DEP0190 warning
    const cmdString = [claudeCli, ...args].map(escapeShellArg).join(' ');
    child = spawn(cmdString, {
      stdio: 'inherit',
      windowsHide: true,
      shell: true,
      env
    });
  } else {
    // When no shell needed: use array form (faster, no shell overhead)
    child = spawn(claudeCli, args, {
      stdio: 'inherit',
      windowsHide: true,
      env
    });
  }

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code || 0);
  });
  child.on('error', () => {
    showClaudeNotFoundError();
    process.exit(1);
  });
}

// Special command handlers
function handleVersionCommand() {
  // Title
  console.log(colored(`CCS (Claude Code Switch) v${CCS_VERSION}`, 'bold'));
  console.log('');

  // Installation section
  console.log(colored('Installation:', 'cyan'));

  // Location
  const installLocation = process.argv[1] || '(not found)';
  console.log(`  ${colored('Location:', 'cyan')} ${installLocation}`);

  // Config path
  const configPath = getConfigPath();
  console.log(`  ${colored('Config:', 'cyan')} ${configPath}`);
  console.log('');

  // Documentation
  console.log(`${colored('Documentation:', 'cyan')} https://github.com/kaitranntt/ccs`);
  console.log(`${colored('License:', 'cyan')} MIT`);
  console.log('');

  // Help hint
  console.log(colored('Run \'ccs --help\' for usage information', 'yellow'));

  process.exit(0);
}

function handleHelpCommand() {
  // Title
  console.log(colored('CCS (Claude Code Switch) - Instant profile switching for Claude CLI', 'bold'));
  console.log('');

  // Usage
  console.log(colored('Usage:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')} [profile] [claude-args...]`);
  console.log(`  ${colored('ccs', 'yellow')} [flags]`);
  console.log('');

  // Description
  console.log(colored('Description:', 'cyan'));
  console.log('  Switch between Claude models instantly. Stop hitting rate limits.');
  console.log('  Maps profile names to Claude settings files via ~/.ccs/config.json');
  console.log('');

  // Profile Switching
  console.log(colored('Profile Switching:', 'cyan'));
  console.log(`  ${colored('ccs', 'yellow')}                         Use default profile`);
  console.log(`  ${colored('ccs glm', 'yellow')}                     Switch to GLM profile`);
  console.log(`  ${colored('ccs kimi', 'yellow')}                    Switch to Kimi profile`);
  console.log(`  ${colored('ccs work', 'yellow')}                    Use work account (saved profile)`);
  console.log(`  ${colored('ccs glm', 'yellow')} "debug this code"   Switch to GLM and run command`);
  console.log(`  ${colored('ccs work', 'yellow')} "review code"      Use work account and run command`);
  console.log('');

  // Account Management
  console.log(colored('Account Management:', 'cyan'));
  console.log(`  ${colored('ccs auth create <profile>', 'yellow')}   Create new profile and login`);
  console.log(`  ${colored('ccs auth list', 'yellow')}               List all saved profiles`);
  console.log(`  ${colored('ccs auth --help', 'yellow')}             Show account management help`);
  console.log('');

  // Flags
  console.log(colored('Flags:', 'cyan'));
  console.log(`  ${colored('-h, --help', 'yellow')}                  Show this help message`);
  console.log(`  ${colored('-v, --version', 'yellow')}               Show version and installation info`);
  console.log('');

  // Configuration
  console.log(colored('Configuration:', 'cyan'));
  console.log('  Config File: ~/.ccs/config.json');
  console.log('  Settings:    ~/.ccs/*.settings.json');
  console.log('  Environment: CCS_CONFIG (override config path)');
  console.log('');

  // Examples
  console.log(colored('Examples:', 'cyan'));
  console.log('  # Try without installing');
  console.log(`  ${colored('npx @kaitranntt/ccs glm', 'yellow')} "write tests"`);
  console.log(`  ${colored('npx @kaitranntt/ccs kimi', 'yellow')} "write tests"`);
  console.log('');
  console.log('  # Use default Claude subscription');
  console.log(`  ${colored('ccs', 'yellow')} "Review this architecture"`);
  console.log('');
  console.log('  # Switch to GLM for cost-effective tasks');
  console.log(`  ${colored('ccs glm', 'yellow')} "Write unit tests"`);
  console.log('');
  console.log('  # Switch to Kimi for alternative option');
  console.log(`  ${colored('ccs kimi', 'yellow')} "Write integration tests"`);
  console.log('');
  console.log('  # Use with verbose output');
  console.log(`  ${colored('ccs glm', 'yellow')} --verbose "Debug error"`);
  console.log(`  ${colored('ccs kimi', 'yellow')} --verbose "Review code"`);
  console.log('');

  // Uninstall
  console.log(colored('Uninstall:', 'yellow'));
  console.log('  npm:          npm uninstall -g @kaitranntt/ccs');
  console.log('  macOS/Linux:  curl -fsSL ccs.kaitran.ca/uninstall | bash');
  console.log('  Windows:      irm ccs.kaitran.ca/uninstall | iex');
  console.log('');

  // Documentation
  console.log(colored('Documentation:', 'cyan'));
  console.log(`  GitHub:  ${colored('https://github.com/kaitranntt/ccs', 'cyan')}`);
  console.log('  Docs:    https://github.com/kaitranntt/ccs/blob/main/README.md');
  console.log('  Issues:  https://github.com/kaitranntt/ccs/issues');
  console.log('');

  // License
  console.log(`${colored('License:', 'cyan')} MIT`);

  process.exit(0);
}

function handleInstallCommand() {
  console.log('');
  console.log('Feature not available');
  console.log('');
  console.log('The --install flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log('For updates: https://github.com/kaitranntt/ccs/issues');
  console.log('');
  process.exit(0);
}

function handleUninstallCommand() {
  console.log('');
  console.log('Feature not available');
  console.log('');
  console.log('The --uninstall flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log('For updates: https://github.com/kaitranntt/ccs/issues');
  console.log('');
  process.exit(0);
}

// Smart profile detection
function detectProfile(args) {
  if (args.length === 0 || args[0].startsWith('-')) {
    // No args or first arg is a flag → use default profile
    return { profile: 'default', remainingArgs: args };
  } else {
    // First arg doesn't start with '-' → treat as profile name
    return { profile: args[0], remainingArgs: args.slice(1) };
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  // Special case: version command (check BEFORE profile detection)
  const firstArg = args[0];
  if (firstArg === 'version' || firstArg === '--version' || firstArg === '-v') {
    handleVersionCommand();
  }

  // Special case: help command
  if (firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
    handleHelpCommand();
    return;
  }

  // Special case: install command
  if (firstArg === '--install') {
    handleInstallCommand();
    return;
  }

  // Special case: uninstall command
  if (firstArg === '--uninstall') {
    handleUninstallCommand();
    return;
  }

  // Special case: auth command (multi-account management)
  if (firstArg === 'auth') {
    const AuthCommands = require('./auth-commands');
    const authCommands = new AuthCommands();
    await authCommands.route(args.slice(1));
    return;
  }

  // Detect profile
  const { profile, remainingArgs } = detectProfile(args);

  // Detect Claude CLI first (needed for all paths)
  const claudeCli = detectClaudeCli();
  if (!claudeCli) {
    showClaudeNotFoundError();
    process.exit(1);
  }

  // Use ProfileDetector to determine profile type
  const ProfileDetector = require('./profile-detector');
  const InstanceManager = require('./instance-manager');
  const ProfileRegistry = require('./profile-registry');
  const { getSettingsPath } = require('./config-manager');

  const detector = new ProfileDetector();

  try {
    const profileInfo = detector.detectProfileType(profile);

    if (profileInfo.type === 'settings') {
      // EXISTING FLOW: Settings-based profile (glm, kimi)
      // Use --settings flag (backward compatible)
      const expandedSettingsPath = getSettingsPath(profileInfo.name);
      execClaude(claudeCli, ['--settings', expandedSettingsPath, ...remainingArgs]);
    } else if (profileInfo.type === 'account') {
      // NEW FLOW: Account-based profile (work, personal)
      // All platforms: Use instance isolation with CLAUDE_CONFIG_DIR
      const registry = new ProfileRegistry();
      const instanceMgr = new InstanceManager();

      // Ensure instance exists (lazy init if needed)
      const instancePath = instanceMgr.ensureInstance(profileInfo.name);

      // Update last_used timestamp
      registry.touchProfile(profileInfo.name);

      // Execute Claude with instance isolation
      const envVars = { CLAUDE_CONFIG_DIR: instancePath };
      execClaude(claudeCli, remainingArgs, envVars);
    } else {
      // DEFAULT: No profile configured, use Claude's own defaults
      execClaude(claudeCli, remainingArgs);
    }
  } catch (error) {
    console.error(`[X] ${error.message}`);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});