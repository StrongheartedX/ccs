/**
 * CLIProxy Sync Module
 *
 * Profile sync functionality for syncing CCS API profiles to CLIProxy config.
 */

// Profile mapper
export type { SyncableProfile, SyncPreviewItem } from './profile-mapper';
export {
  loadSyncableProfiles,
  mapProfileToClaudeKey,
  generateSyncPayload,
  generateSyncPreview,
  getSyncableProfileCount,
  isProfileSyncable,
} from './profile-mapper';

// Model alias config
export type { ModelAlias, ModelAliasConfig } from './model-alias-config';
export {
  getModelAliasesPath,
  loadModelAliases,
  saveModelAliases,
  getProfileAliases,
  addProfileAlias,
  removeProfileAlias,
  listAllAliases,
  DEFAULT_MODEL_ALIASES,
} from './model-alias-config';

// Local config sync
export { syncToLocalConfig, getLocalSyncStatus } from './local-config-sync';

// Auto-sync watcher
export {
  startAutoSyncWatcher,
  stopAutoSyncWatcher,
  restartAutoSyncWatcher,
  isAutoSyncEnabled,
  getAutoSyncStatus,
} from './auto-sync-watcher';
