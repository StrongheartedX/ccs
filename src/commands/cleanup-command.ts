/**
 * Cleanup Command Handler
 *
 * Removes old CLIProxy logs to free up disk space.
 * Logs can accumulate to several GB without user awareness.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCliproxyDir } from '../cliproxy/config-generator';
import { info, ok, warn } from '../utils/ui';

/** Get the CLIProxy logs directory */
function getLogsDir(): string {
  return path.join(getCliproxyDir(), 'logs');
}

/** Format bytes to human-readable size */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/** Calculate total size of a directory */
function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;

  let totalSize = 0;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const stats = fs.lstatSync(filePath); // Use lstat to detect symlinks
      if (stats.isFile() && !stats.isSymbolicLink()) {
        totalSize += stats.size;
      } else if (stats.isDirectory() && !stats.isSymbolicLink()) {
        totalSize += getDirSize(filePath);
      }
      // Skip symlinks for safety
    } catch {
      // File may have been deleted between readdir and stat - skip
    }
  }

  return totalSize;
}

/** Count files in a directory */
function countFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dirPath);

  for (const entry of entries) {
    const filePath = path.join(dirPath, entry);
    try {
      const stats = fs.lstatSync(filePath);
      if (stats.isFile() && !stats.isSymbolicLink()) {
        count++;
      }
    } catch {
      // File may have been deleted - skip
    }
  }
  return count;
}

/** Delete all regular files in a directory (skips symlinks for safety) */
function cleanDirectory(dirPath: string): { deleted: number; freedBytes: number } {
  if (!fs.existsSync(dirPath)) return { deleted: 0, freedBytes: 0 };

  let deleted = 0;
  let freedBytes = 0;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const stats = fs.lstatSync(filePath);

      // Only delete regular files, skip symlinks for security
      if (stats.isFile() && !stats.isSymbolicLink()) {
        freedBytes += stats.size;
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch {
      // File may have been deleted or inaccessible - skip
    }
  }

  return { deleted, freedBytes };
}

/** Print help for cleanup command */
function printHelp(): void {
  console.log('');
  console.log('Usage: ccs cleanup [options]');
  console.log('');
  console.log('Remove old CLIProxy logs to free up disk space.');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run     Show what would be deleted without deleting');
  console.log('  --force       Skip confirmation prompt');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  ccs cleanup           Interactive cleanup with confirmation');
  console.log('  ccs cleanup --dry-run Preview cleanup without deleting');
  console.log('  ccs cleanup --force   Clean without confirmation');
  console.log('');
  console.log('Note: CLIProxy logging is disabled by default.');
  console.log('To enable logging, edit ~/.ccs/config.yaml:');
  console.log('  cliproxy:');
  console.log('    logging:');
  console.log('      enabled: true');
  console.log('');
}

/**
 * Handle cleanup command
 */
export async function handleCleanupCommand(args: string[]): Promise<void> {
  // Handle help
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const logsDir = getLogsDir();

  // Check if logs directory exists
  if (!fs.existsSync(logsDir)) {
    console.log(info('No CLIProxy logs found.'));
    return;
  }

  // Calculate current size
  const currentSize = getDirSize(logsDir);
  const fileCount = countFiles(logsDir);

  if (fileCount === 0) {
    console.log(info('No log files to clean.'));
    return;
  }

  console.log('');
  console.log(`CLIProxy Logs: ${logsDir}`);
  console.log(`  Files: ${fileCount}`);
  console.log(`  Size:  ${formatBytes(currentSize)}`);
  console.log('');

  if (dryRun) {
    console.log(info('Dry run - no files deleted.'));
    console.log(`Would delete ${fileCount} files (${formatBytes(currentSize)})`);
    return;
  }

  // Confirm unless --force
  if (!force) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`Delete ${fileCount} log files (${formatBytes(currentSize)})? [y/N] `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      return;
    }
  }

  // Perform cleanup
  const { deleted, freedBytes } = cleanDirectory(logsDir);
  console.log(ok(`Deleted ${deleted} files, freed ${formatBytes(freedBytes)}`));

  // Suggest disabling logging if it was enabled
  if (deleted > 0) {
    console.log('');
    console.log(warn('Tip: CLIProxy logging is now disabled by default.'));
    console.log('     Run `ccs doctor --fix` to update your config.');
  }
}
