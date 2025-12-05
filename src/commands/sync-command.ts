/**
 * Sync Command Handler
 *
 * Handle sync command for CCS.
 */

import { colored } from '../utils/helpers';

/**
 * Handle sync command
 */
export async function handleSyncCommand(): Promise<void> {
  console.log('');
  console.log(colored('Syncing CCS Components...', 'cyan'));
  console.log('');

  // First, copy .claude/ directory from package to ~/.ccs/.claude/
  const { ClaudeDirInstaller } = await import('../utils/claude-dir-installer');
  const installer = new ClaudeDirInstaller();
  installer.install();

  console.log('');

  const cleanupResult = installer.cleanupDeprecated();
  if (cleanupResult.success && cleanupResult.cleanedFiles.length > 0) {
    console.log('');
  }

  // Then, create symlinks from ~/.ccs/.claude/ to ~/.claude/
  const { ClaudeSymlinkManager } = await import('../utils/claude-symlink-manager');
  const manager = new ClaudeSymlinkManager();
  manager.install(false);

  console.log('');

  // Repair shared symlinks (~/.ccs/shared/ → ~/.claude/)
  // This fixes symlinks broken by Claude CLI's atomic writes (e.g., toggle thinking)
  const SharedManager = (await import('../management/shared-manager')).default;
  const sharedManager = new SharedManager();
  sharedManager.ensureSharedDirectories();
  console.log(colored('[OK]', 'green') + ' Shared symlinks verified');

  console.log('');
  console.log(colored('[OK] Sync complete!', 'green'));
  console.log('');

  process.exit(0);
}
