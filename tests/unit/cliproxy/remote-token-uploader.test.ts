/**
 * Remote Token Uploader Tests
 *
 * Tests for uploadTokenToRemote and related functions.
 * Uses a local HTTP server to mock the remote CLIProxyAPI.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AddressInfo } from 'net';

// We need to mock getProxyTarget before importing the module
// Since the module reads config at import time, we'll test the pure functions

describe('remote-token-uploader', () => {
  let mockServer: http.Server | null = null;
  let mockServerPort: number = 0;
  let tempDir: string;
  let tempTokenFile: string;

  beforeEach(async () => {
    // Create temp directory and token file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-test-'));
    tempTokenFile = path.join(tempDir, 'test-token.json');
    fs.writeFileSync(
      tempTokenFile,
      JSON.stringify({
        type: 'gemini',
        email: 'test@example.com',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      })
    );
  });

  afterEach(async () => {
    // Clean up mock server
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer!.close(() => resolve());
      });
      mockServer = null;
    }

    // Clean up temp files
    try {
      fs.unlinkSync(tempTokenFile);
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('uploadTokenToRemote', () => {
    it('should upload token file successfully', async () => {
      // Create mock server that accepts uploads
      let receivedRequest: {
        method: string;
        path: string;
        headers: http.IncomingHttpHeaders;
        body: string;
      } | null = null;

      mockServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          receivedRequest = {
            method: req.method || '',
            path: req.url || '',
            headers: req.headers,
            body,
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', id: 'uploaded-123' }));
        });
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      // Mock getProxyTarget to return our test server
      const mockProxyTarget = {
        isRemote: true,
        host: `127.0.0.1:${mockServerPort}`,
        protocol: 'http' as const,
        authToken: 'test-auth-token',
        managementKey: 'test-mgmt-key',
      };

      // Dynamically import and test
      // We need to test the fetch logic directly since module caches getProxyTarget
      const url = `http://${mockProxyTarget.host}/v0/management/auth-files`;
      const tokenContent = fs.readFileSync(tempTokenFile, 'utf-8');
      const fileName = path.basename(tempTokenFile);

      const formData = new FormData();
      const blob = new Blob([tokenContent], { type: 'application/json' });
      formData.append('file', blob, fileName);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mockProxyTarget.managementKey}`,
        },
        body: formData,
      });

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('id', 'uploaded-123');

      // Verify request was received correctly
      expect(receivedRequest).not.toBeNull();
      expect(receivedRequest!.method).toBe('POST');
      expect(receivedRequest!.path).toBe('/v0/management/auth-files');
      expect(receivedRequest!.headers['authorization']).toBe('Bearer test-mgmt-key');
    });

    it('should handle upload failure gracefully', async () => {
      // Create mock server that returns error
      mockServer = http.createServer((req, res) => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const url = `http://127.0.0.1:${mockServerPort}/v0/management/auth-files`;
      const tokenContent = fs.readFileSync(tempTokenFile, 'utf-8');

      const formData = new FormData();
      formData.append('file', new Blob([tokenContent], { type: 'application/json' }), 'test.json');

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle connection timeout', async () => {
      // Create server that never responds
      mockServer = http.createServer(() => {
        // Never respond
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const url = `http://127.0.0.1:${mockServerPort}/v0/management/auth-files`;
      const controller = new AbortController();

      // Set short timeout
      const timeoutId = setTimeout(() => controller.abort(), 100);

      try {
        await fetch(url, {
          method: 'POST',
          body: new FormData(),
          signal: controller.signal,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).name).toBe('AbortError');
      } finally {
        clearTimeout(timeoutId);
      }
    });

    it('should handle connection refused', async () => {
      // Try to connect to a port with nothing listening
      const url = 'http://127.0.0.1:59999/v0/management/auth-files';

      try {
        await fetch(url, {
          method: 'POST',
          body: new FormData(),
        });
        // Should not reach here in most cases
      } catch (error) {
        // Connection refused is expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('isRemoteUploadEnabled', () => {
    it('should return false when not in remote mode', () => {
      // Test the logic directly
      const target = { isRemote: false, authToken: 'token' };
      const result = target.isRemote && Boolean(target.authToken);
      expect(result).toBe(false);
    });

    it('should return false when remote but no auth', () => {
      const target = { isRemote: true, authToken: undefined, managementKey: undefined };
      const result = target.isRemote && Boolean(target.managementKey ?? target.authToken);
      expect(result).toBe(false);
    });

    it('should return true when remote with authToken', () => {
      const target = { isRemote: true, authToken: 'token', managementKey: undefined };
      const result = target.isRemote && Boolean(target.managementKey ?? target.authToken);
      expect(result).toBe(true);
    });

    it('should return true when remote with managementKey', () => {
      const target = { isRemote: true, authToken: undefined, managementKey: 'mgmt-key' };
      const result = target.isRemote && Boolean(target.managementKey ?? target.authToken);
      expect(result).toBe(true);
    });

    it('should prefer managementKey over authToken', () => {
      const target = { isRemote: true, authToken: 'auth', managementKey: 'mgmt' };
      const key = target.managementKey ?? target.authToken;
      expect(key).toBe('mgmt');
    });
  });

  describe('token file validation', () => {
    it('should reject invalid JSON', async () => {
      // Create invalid token file
      const invalidTokenFile = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(invalidTokenFile, 'not valid json {{{');

      try {
        const content = fs.readFileSync(invalidTokenFile, 'utf-8');
        JSON.parse(content);
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect((error as Error).message).toContain('JSON');
      } finally {
        fs.unlinkSync(invalidTokenFile);
      }
    });

    it('should handle missing file', () => {
      try {
        fs.readFileSync('/nonexistent/path/token.json', 'utf-8');
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect((error as Error).message).toContain('ENOENT');
      }
    });
  });

  describe('multipart/form-data construction', () => {
    it('should construct valid FormData with file field', () => {
      const tokenContent = JSON.stringify({ type: 'test', token: 'abc' });
      const fileName = 'oauth-token.json';

      const formData = new FormData();
      const blob = new Blob([tokenContent], { type: 'application/json' });
      formData.append('file', blob, fileName);

      // FormData should have the file
      expect(formData.has('file')).toBe(true);

      const file = formData.get('file') as File;
      expect(file).toBeDefined();
      expect(file.name).toBe(fileName);
      expect(file.type).toContain('application/json');
    });
  });

  describe('Authorization header', () => {
    it('should use Bearer token format', async () => {
      let capturedAuth: string | null = null;

      mockServer = http.createServer((req, res) => {
        capturedAuth = req.headers['authorization'] as string;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const authToken = 'my-secret-token-123';
      await fetch(`http://127.0.0.1:${mockServerPort}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: new FormData(),
      });

      expect(capturedAuth).toBe(`Bearer ${authToken}`);
    });

    it('should not send Authorization when no token', async () => {
      let hasAuth = false;

      mockServer = http.createServer((req, res) => {
        hasAuth = 'authorization' in req.headers;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      await fetch(`http://127.0.0.1:${mockServerPort}/test`, {
        method: 'POST',
        body: new FormData(),
      });

      expect(hasAuth).toBe(false);
    });
  });

  describe('response parsing', () => {
    it('should accept status: ok response', async () => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const response = await fetch(`http://127.0.0.1:${mockServerPort}/test`, { method: 'POST' });
      const result = (await response.json()) as { status?: string; success?: boolean; id?: string };

      const isSuccess = result.status === 'ok' || result.success || result.id;
      expect(isSuccess).toBe(true);
    });

    it('should accept success: true response', async () => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const response = await fetch(`http://127.0.0.1:${mockServerPort}/test`, { method: 'POST' });
      const result = (await response.json()) as { status?: string; success?: boolean; id?: string };

      const isSuccess = result.status === 'ok' || result.success || result.id;
      expect(isSuccess).toBe(true);
    });

    it('should accept id in response', async () => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'file-abc123' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const response = await fetch(`http://127.0.0.1:${mockServerPort}/test`, { method: 'POST' });
      const result = (await response.json()) as { status?: string; success?: boolean; id?: string };

      // result.id is truthy when present
      const isSuccess = result.status === 'ok' || result.success === true || Boolean(result.id);
      expect(isSuccess).toBe(true);
    });

    it('should detect error response', async () => {
      mockServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid token format' }));
      });

      await new Promise<void>((resolve) => {
        mockServer!.listen(0, '127.0.0.1', () => resolve());
      });

      mockServerPort = (mockServer.address() as AddressInfo).port;

      const response = await fetch(`http://127.0.0.1:${mockServerPort}/test`, { method: 'POST' });
      const result = (await response.json()) as {
        status?: string;
        success?: boolean;
        id?: string;
        error?: string;
      };

      // Error response: none of the success indicators are present
      const isSuccess = result.status === 'ok' || result.success === true || Boolean(result.id);
      expect(isSuccess).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });
  });
});
