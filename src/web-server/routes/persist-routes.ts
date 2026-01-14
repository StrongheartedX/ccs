/**
 * Persist Routes - Backup management for ~/.claude/settings.json
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const router = Router();

interface BackupFile {
  path: string;
  timestamp: string;
  date: Date;
}

/** Simple in-memory mutex for restore operations */
let restoreLock = false;

/** Get Claude settings.json path */
function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/** Check if path is a symlink (security check) */
function isSymlink(filePath: string): boolean {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Get all backup files sorted by date (newest first) */
function getBackupFiles(): BackupFile[] {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const backupPattern = /^settings\.json\.backup\.(\d{8}_\d{6})$/;
  const files = fs
    .readdirSync(dir)
    .filter((f) => backupPattern.test(f))
    .map((f) => {
      const match = f.match(backupPattern);
      if (!match) return null;
      const timestamp = match[1];
      const year = parseInt(timestamp.slice(0, 4));
      const month = parseInt(timestamp.slice(4, 6)) - 1;
      const day = parseInt(timestamp.slice(6, 8));
      const hour = parseInt(timestamp.slice(9, 11));
      const min = parseInt(timestamp.slice(11, 13));
      const sec = parseInt(timestamp.slice(13, 15));
      return {
        path: path.join(dir, f),
        timestamp,
        date: new Date(year, month, day, hour, min, sec),
      };
    })
    .filter((f): f is BackupFile => f !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return files;
}

/**
 * GET /api/persist/backups - List available backups
 */
router.get('/backups', (_req: Request, res: Response): void => {
  try {
    const backups = getBackupFiles();
    res.json({
      backups: backups.map((b, i) => ({
        timestamp: b.timestamp,
        date: b.date.toISOString(),
        isLatest: i === 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/persist/restore - Restore from a backup
 * Body: { timestamp?: string } - If not provided, restores latest
 */
router.post('/restore', (req: Request, res: Response): void => {
  // Check concurrent restore lock
  if (restoreLock) {
    res.status(409).json({ error: 'Restore already in progress' });
    return;
  }

  restoreLock = true;

  try {
    const { timestamp } = req.body;
    const backups = getBackupFiles();

    if (backups.length === 0) {
      res.status(404).json({ error: 'No backups found' });
      return;
    }

    // Find backup
    let backup: BackupFile;
    if (!timestamp) {
      backup = backups[0]; // Latest
    } else {
      const found = backups.find((b) => b.timestamp === timestamp);
      if (!found) {
        res.status(404).json({ error: `Backup not found: ${timestamp}` });
        return;
      }
      backup = found;
    }

    // Security checks
    if (isSymlink(backup.path)) {
      res.status(400).json({ error: 'Backup file is a symlink - refusing for security' });
      return;
    }

    const settingsPath = getClaudeSettingsPath();
    if (isSymlink(settingsPath)) {
      res.status(400).json({ error: 'settings.json is a symlink - refusing for security' });
      return;
    }

    // Read and validate backup JSON (do this once atomically)
    let backupContent: string;
    try {
      backupContent = fs.readFileSync(backup.path, 'utf8');
      const parsed = JSON.parse(backupContent);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        res.status(400).json({ error: 'Backup file is corrupted' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Backup file is corrupted or invalid JSON' });
      return;
    }

    // Atomic restore with rollback capability
    const settingsDir = path.dirname(settingsPath);
    const tempPath = path.join(settingsDir, 'settings.json.restore-tmp');
    const backupPath = path.join(settingsDir, 'settings.json.rollback-tmp');

    try {
      // Step 1: Backup current settings for rollback
      if (fs.existsSync(settingsPath)) {
        fs.copyFileSync(settingsPath, backupPath);
      }

      // Step 2: Write validated content to temp file
      fs.writeFileSync(tempPath, backupContent, 'utf8');

      // Step 3: Atomic rename (replaces existing file)
      fs.renameSync(tempPath, settingsPath);

      // Step 4: Cleanup rollback backup on success
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      res.json({
        success: true,
        timestamp: backup.timestamp,
        date: backup.date.toISOString(),
      });
    } catch (error) {
      // Rollback on failure
      try {
        if (fs.existsSync(backupPath)) {
          fs.renameSync(backupPath, settingsPath);
        }
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    restoreLock = false;
  }
});

export default router;
