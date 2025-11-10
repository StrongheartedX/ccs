'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Profile Registry (Simplified)
 *
 * Manages account profile metadata in ~/.ccs/profiles.json
 * Each profile represents an isolated Claude instance with login credentials.
 *
 * Profile Schema (v3.0 - Minimal):
 * {
 *   type: 'account',         // Profile type
 *   created: <ISO timestamp>, // Creation time
 *   last_used: <ISO timestamp or null> // Last usage time
 * }
 *
 * Removed fields from v2.x:
 * - vault: No encrypted vault (credentials in instance)
 * - subscription: No credential reading
 * - email: No credential reading
 */
class ProfileRegistry {
  constructor() {
    this.profilesPath = path.join(os.homedir(), '.ccs', 'profiles.json');
  }

  /**
   * Read profiles from disk
   * @returns {Object} Profiles data
   */
  _read() {
    if (!fs.existsSync(this.profilesPath)) {
      return {
        version: '2.0.0',
        profiles: {},
        default: null
      };
    }

    try {
      const data = fs.readFileSync(this.profilesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to read profiles: ${error.message}`);
    }
  }

  /**
   * Write profiles to disk atomically
   * @param {Object} data - Profiles data
   */
  _write(data) {
    const dir = path.dirname(this.profilesPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Atomic write: temp file + rename
    const tempPath = `${this.profilesPath}.tmp`;

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      fs.renameSync(tempPath, this.profilesPath);
    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw new Error(`Failed to write profiles: ${error.message}`);
    }
  }

  /**
   * Create a new profile
   * @param {string} name - Profile name
   * @param {Object} metadata - Profile metadata (type, created, last_used)
   */
  createProfile(name, metadata = {}) {
    const data = this._read();

    if (data.profiles[name]) {
      throw new Error(`Profile already exists: ${name}`);
    }

    // v3.0 minimal schema: only essential fields
    data.profiles[name] = {
      type: metadata.type || 'account',
      created: new Date().toISOString(),
      last_used: null
    };

    // Note: No longer auto-set as default
    // Users must explicitly run: ccs auth default <profile>
    // Default always stays on implicit 'default' profile (uses ~/.claude/)

    this._write(data);
  }

  /**
   * Get profile metadata
   * @param {string} name - Profile name
   * @returns {Object} Profile metadata
   */
  getProfile(name) {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    return data.profiles[name];
  }

  /**
   * Update profile metadata
   * @param {string} name - Profile name
   * @param {Object} updates - Fields to update
   */
  updateProfile(name, updates) {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    data.profiles[name] = {
      ...data.profiles[name],
      ...updates
    };

    this._write(data);
  }

  /**
   * Delete a profile
   * @param {string} name - Profile name
   */
  deleteProfile(name) {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    delete data.profiles[name];

    // Clear default if it was the deleted profile
    if (data.default === name) {
      // Set to first remaining profile or null
      const remaining = Object.keys(data.profiles);
      data.default = remaining.length > 0 ? remaining[0] : null;
    }

    this._write(data);
  }

  /**
   * List all profiles
   * @returns {Array} Array of profile names
   */
  listProfiles() {
    const data = this._read();
    return Object.keys(data.profiles);
  }

  /**
   * Get all profiles with metadata
   * @returns {Object} All profiles
   */
  getAllProfiles() {
    const data = this._read();
    return data.profiles;
  }

  /**
   * Get default profile name
   * @returns {string|null} Default profile name
   */
  getDefaultProfile() {
    const data = this._read();
    return data.default;
  }

  /**
   * Set default profile
   * @param {string} name - Profile name
   */
  setDefaultProfile(name) {
    const data = this._read();

    if (!data.profiles[name]) {
      throw new Error(`Profile not found: ${name}`);
    }

    data.default = name;
    this._write(data);
  }

  /**
   * Check if profile exists
   * @param {string} name - Profile name
   * @returns {boolean}
   */
  hasProfile(name) {
    const data = this._read();
    return !!data.profiles[name];
  }

  /**
   * Update last used timestamp
   * @param {string} name - Profile name
   */
  touchProfile(name) {
    this.updateProfile(name, {
      last_used: new Date().toISOString()
    });
  }
}

module.exports = ProfileRegistry;
