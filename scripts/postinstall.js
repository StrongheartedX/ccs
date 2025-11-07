#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * CCS Postinstall Script
 * Automatically creates config files in ~/.ccs/ after npm install
 *
 * Runs when: npm install -g @kaitranntt/ccs
 * Idempotent: Safe to run multiple times (won't overwrite existing configs)
 * Cross-platform: Works on Unix, macOS, Windows
 */

function createConfigFiles() {
  try {
    // Get user home directory (cross-platform)
    const homedir = os.homedir();
    const ccsDir = path.join(homedir, '.ccs');

    // Create ~/.ccs/ directory if missing
    if (!fs.existsSync(ccsDir)) {
      fs.mkdirSync(ccsDir, { recursive: true, mode: 0o755 });
      console.log('[OK] Created directory: ~/.ccs/');
    }

    // Create config.json if missing
    const configPath = path.join(ccsDir, 'config.json');
    if (!fs.existsSync(configPath)) {
      const config = {
        profiles: {
          glm: '~/.ccs/glm.settings.json',
          kimi: '~/.ccs/kimi.settings.json',
          default: '~/.claude/settings.json'
        }
      };

      // Atomic write: temp file → rename
      const tmpPath = `${configPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpPath, configPath);

      console.log('[OK] Created config: ~/.ccs/config.json');
    } else {
      console.log('[OK] Config exists: ~/.ccs/config.json (preserved)');
    }

    // Create glm.settings.json if missing
    const glmSettingsPath = path.join(ccsDir, 'glm.settings.json');
    if (!fs.existsSync(glmSettingsPath)) {
      const glmSettings = {
        env: {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: 'YOUR_GLM_API_KEY_HERE',
          ANTHROPIC_MODEL: 'glm-4.6',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-4.6',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.6',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.6'
        }
      };

      // Atomic write
      const tmpPath = `${glmSettingsPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(glmSettings, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpPath, glmSettingsPath);

      console.log('[OK] Created GLM profile: ~/.ccs/glm.settings.json');
      console.log('');
      console.log('  [!] Configure GLM API key:');
      console.log('      1. Get key from: https://api.z.ai');
      console.log('      2. Edit: ~/.ccs/glm.settings.json');
      console.log('      3. Replace: YOUR_GLM_API_KEY_HERE');
    } else {
      console.log('[OK] GLM profile exists: ~/.ccs/glm.settings.json (preserved)');
    }

    // Create kimi.settings.json if missing
    const kimiSettingsPath = path.join(ccsDir, 'kimi.settings.json');
    if (!fs.existsSync(kimiSettingsPath)) {
      const kimiSettings = {
        env: {
          ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/',
          ANTHROPIC_AUTH_TOKEN: 'YOUR_KIMI_API_KEY_HERE',
          ANTHROPIC_MODEL: 'kimi-for-coding',
          ANTHROPIC_SMALL_FAST_MODEL: 'kimi-for-coding',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'kimi-for-coding',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-for-coding',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-for-coding'
        },
        alwaysThinkingEnabled: true
      };

      // Atomic write
      const tmpPath = `${kimiSettingsPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(kimiSettings, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpPath, kimiSettingsPath);

      console.log('[OK] Created Kimi profile: ~/.ccs/kimi.settings.json');
      console.log('');
      console.log('  [!] Configure Kimi API key:');
      console.log('      1. Get key from: https://www.kimi.com/coding (membership page)');
      console.log('      2. Edit: ~/.ccs/kimi.settings.json');
      console.log('      3. Replace: YOUR_KIMI_API_KEY_HERE');
    } else {
      console.log('[OK] Kimi profile exists: ~/.ccs/kimi.settings.json (preserved)');
    }

    console.log('');
    console.log('[OK] CCS configuration ready!');
    console.log('  Run: ccs --version');

  } catch (err) {
    // Silent failure: don't break npm install
    console.warn('');
    console.warn('[!] Could not auto-create CCS configuration');
    console.warn(`    Error: ${err.message}`);
    console.warn('');
    console.warn('    Manual setup:');
    console.warn('      mkdir -p ~/.ccs');
    console.warn('      # See: https://github.com/kaitranntt/ccs#configuration');
    console.warn('');

    // Don't exit with error code - allow npm install to succeed
    process.exit(0);
  }
}

// Run postinstall
createConfigFiles();
