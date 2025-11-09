'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Instance Manager (Simplified)
 *
 * Manages isolated Claude CLI instances per profile for concurrent sessions.
 * Each instance is an isolated CLAUDE_CONFIG_DIR where users login directly.
 * No credential copying/encryption - Claude manages credentials per instance.
 */
class InstanceManager {
  constructor() {
    this.instancesDir = path.join(os.homedir(), '.ccs', 'instances');
  }

  /**
   * Ensure instance exists for profile (lazy init only)
   * @param {string} profileName - Profile name
   * @returns {string} Instance path
   */
  ensureInstance(profileName) {
    const instancePath = this.getInstancePath(profileName);

    // Lazy initialization
    if (!fs.existsSync(instancePath)) {
      this.initializeInstance(profileName, instancePath);
    }

    // Validate structure (auto-fix missing dirs)
    this.validateInstance(instancePath);

    return instancePath;
  }

  /**
   * Get instance path for profile
   * @param {string} profileName - Profile name
   * @returns {string} Instance directory path
   */
  getInstancePath(profileName) {
    const safeName = this._sanitizeName(profileName);
    return path.join(this.instancesDir, safeName);
  }

  /**
   * Initialize new instance directory
   * @param {string} profileName - Profile name
   * @param {string} instancePath - Instance directory path
   * @throws {Error} If initialization fails
   */
  initializeInstance(profileName, instancePath) {
    try {
      // Create base directory
      fs.mkdirSync(instancePath, { recursive: true, mode: 0o700 });

      // Create Claude-expected subdirectories
      const subdirs = [
        'session-env',
        'todos',
        'logs',
        'file-history',
        'shell-snapshots',
        'debug',
        '.anthropic',
        'commands',
        'skills'
      ];

      subdirs.forEach(dir => {
        const dirPath = path.join(instancePath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
        }
      });

      // Copy global configs if exist
      this._copyGlobalConfigs(instancePath);
    } catch (error) {
      throw new Error(`Failed to initialize instance for ${profileName}: ${error.message}`);
    }
  }

  /**
   * Validate instance directory structure (auto-fix missing directories)
   * @param {string} instancePath - Instance path
   */
  validateInstance(instancePath) {
    // Check required directories (auto-create if missing for migration)
    const requiredDirs = [
      'session-env',
      'todos',
      'logs',
      'file-history',
      'shell-snapshots',
      'debug',
      '.anthropic'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(instancePath, dir);
      if (!fs.existsSync(dirPath)) {
        // Auto-create missing directory (migration from older versions)
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      }
    }

    // Note: Credentials managed by Claude CLI in instance (no validation needed)
  }

  /**
   * Delete instance for profile
   * @param {string} profileName - Profile name
   */
  deleteInstance(profileName) {
    const instancePath = this.getInstancePath(profileName);

    if (!fs.existsSync(instancePath)) {
      return;
    }

    // Recursive delete
    fs.rmSync(instancePath, { recursive: true, force: true });
  }

  /**
   * List all instance names
   * @returns {Array<string>} Instance names
   */
  listInstances() {
    if (!fs.existsSync(this.instancesDir)) {
      return [];
    }

    return fs.readdirSync(this.instancesDir)
      .filter(name => {
        const instancePath = path.join(this.instancesDir, name);
        return fs.statSync(instancePath).isDirectory();
      });
  }

  /**
   * Check if instance exists for profile
   * @param {string} profileName - Profile name
   * @returns {boolean} True if exists
   */
  hasInstance(profileName) {
    const instancePath = this.getInstancePath(profileName);
    return fs.existsSync(instancePath);
  }

  /**
   * Copy global configs to instance (optional)
   * @param {string} instancePath - Instance path
   */
  _copyGlobalConfigs(instancePath) {
    const globalConfigDir = path.join(os.homedir(), '.claude');

    // Copy settings.json if exists
    const globalSettings = path.join(globalConfigDir, 'settings.json');
    if (fs.existsSync(globalSettings)) {
      const instanceSettings = path.join(instancePath, 'settings.json');
      fs.copyFileSync(globalSettings, instanceSettings);
    }

    // Copy commands directory if exists
    const globalCommands = path.join(globalConfigDir, 'commands');
    if (fs.existsSync(globalCommands)) {
      const instanceCommands = path.join(instancePath, 'commands');
      this._copyDirectory(globalCommands, instanceCommands);
    }

    // Copy skills directory if exists
    const globalSkills = path.join(globalConfigDir, 'skills');
    if (fs.existsSync(globalSkills)) {
      const instanceSkills = path.join(instancePath, 'skills');
      this._copyDirectory(globalSkills, instanceSkills);
    }
  }

  /**
   * Copy directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   */
  _copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this._copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Sanitize profile name for filesystem
   * @param {string} name - Profile name
   * @returns {string} Safe name
   */
  _sanitizeName(name) {
    // Replace unsafe characters with dash
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  }
}

module.exports = InstanceManager;
