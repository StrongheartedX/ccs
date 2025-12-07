/**
 * File Watcher (Phase 04)
 *
 * Stub for chokidar file watching - will be implemented in Phase 04.
 * Watches config files and broadcasts changes to WebSocket clients.
 */

import { FSWatcher } from 'chokidar';

export interface WatcherOptions {
  paths: string[];
  onChange: (path: string) => void;
}

/**
 * Create file watcher for config files (Phase 04)
 */
export function createFileWatcher(_options: WatcherOptions): FSWatcher | null {
  // Will be implemented in Phase 04
  // Use chokidar to watch config.json, settings files, profiles.json
  return null;
}
