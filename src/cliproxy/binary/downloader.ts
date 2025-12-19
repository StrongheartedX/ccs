/**
 * Binary Downloader
 * Handles downloading files with retry logic, progress tracking, and redirect following.
 */

import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { DownloadResult, ProgressCallback } from '../types';

/** Default configuration for downloader */
export interface DownloaderConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable verbose logging */
  verbose: boolean;
}

const DEFAULT_CONFIG: DownloaderConfig = {
  maxRetries: 3,
  verbose: false,
};

/**
 * Download file from URL with progress tracking
 */
export function downloadFile(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback,
  verbose = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleResponse = (res: http.IncomingMessage) => {
      // Handle redirects (GitHub releases use 302)
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        if (verbose) {
          console.error(`[cliproxy] Following redirect: ${redirectUrl}`);
        }
        downloadFile(redirectUrl, destPath, onProgress, verbose).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress({
            total: totalBytes,
            downloaded: downloadedBytes,
            percentage: Math.round((downloadedBytes / totalBytes) * 100),
          });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Cleanup partial file
        reject(err);
      });

      res.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, handleResponse);

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Download timeout (60s)'));
    });
  });
}

/**
 * Download file with retry logic and exponential backoff
 */
export async function downloadWithRetry(
  url: string,
  destPath: string,
  config: Partial<DownloaderConfig> = {}
): Promise<DownloadResult> {
  const { maxRetries, verbose } = { ...DEFAULT_CONFIG, ...config };
  let lastError = '';
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await downloadFile(url, destPath, undefined, verbose);
      return { success: true, filePath: destPath, retries };
    } catch (error) {
      const err = error as Error;
      lastError = err.message;
      retries++;

      if (retries < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retries - 1) * 1000;
        if (verbose) {
          console.error(`[cliproxy] Retry ${retries}/${maxRetries} after ${delay}ms: ${lastError}`);
        }
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: `Download failed after ${retries} attempts: ${lastError}`,
    retries,
  };
}

/**
 * Fetch text content from URL
 */
export function fetchText(url: string, verbose = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const handleResponse = (res: http.IncomingMessage) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        fetchText(redirectUrl, verbose).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    };

    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, handleResponse);
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout (30s)'));
    });
  });
}

/**
 * Fetch JSON from URL (for GitHub API)
 */
export function fetchJson(url: string, verbose = false): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'CCS-CLIProxyAPI-Updater/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    const handleResponse = (res: http.IncomingMessage) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        fetchJson(redirectUrl, verbose).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API error: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON from GitHub API'));
        }
      });
      res.on('error', reject);
    };

    const req = https.get(url, options, handleResponse);
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('GitHub API timeout (10s)'));
    });
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
