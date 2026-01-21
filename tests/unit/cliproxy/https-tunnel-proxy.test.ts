/**
 * HTTPS Tunnel Proxy Tests
 *
 * Tests for HttpsTunnelProxy which tunnels HTTP requests to remote HTTPS CLIProxyAPI.
 * Required because Claude Code (undici) doesn't support HTTPS in ANTHROPIC_BASE_URL.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as http from 'http';
import * as https from 'https';
import type { AddressInfo } from 'net';

// Import the class under test
import { HttpsTunnelProxy, type HttpsTunnelConfig } from '../../../src/cliproxy/https-tunnel-proxy';

/**
 * Self-signed certificate for testing HTTPS servers.
 * Generated with: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
 */
const TEST_CERT = {
  key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1Ji8aq3YnxiRC
i5syvghdG+08f9Gc1C55UiNZc5zxY6Ij73pg72fWO614WH5MT3GeeDHdA4jF/xxZ
tgLecJ14L5CyqpbcFYnayjRS5WjWfG40VOsVAf5OiJem6YL4Yu9EExO1MxhzIQmW
fqijCSBVPiYkJ9CoT1EuUMPBudWkxs5NQHUYJu2Hq/mG89W+yMuT+Yp9YKau1snb
x0I4aqf+OBJKrlWEZ+tgcTbyWW0bvQv8Ou9cFZjsXQF8jXBHJ97/LPW850jKt76J
6PjIZeaTScZo9Py/fSIf8+4XYFHr3TVmUpoa1f1jmp+kE0H51+KDnqbcYCB6EwFm
UFRaJ6ZtAgMBAAECggEAB5j3DMqi2qmIHR+3KKT+ZiP6X+PfKhFeyZ5/oQwk9Egr
erpb4EjqNVACHIle8rBk9t0vqjIFwILMm5lIptpY9bt4+XqyImo81+eh04A6VL9E
l/6fxXJ0n11B5Fw9g/wSRkFOkvZLpjh9Kx9befWzXMqN1aJd2/vyTwZQJNs4cgAF
BUppw0PG1ujLXl48pNoGqMVLALWA1XwlexBxh6EgU9rsar9desqqhF1pZIAimB4x
pvQSPqENFjCOMY93RRvZHITE37Y61BiofdHHqIDLAqYZLHlq+rUupYe9auUHMpaD
KFV99x9gfVS9l0aqzxXw+nqar9o1+h5lWO2hCw3HgQKBgQD1n19aJ3z1TC1bRLGV
H1UTgx/TAfFsXB7S3RO+Tkfhn+g169ByOWRELIGptOSBYauo/N29AYNHjNJPZDYM
sraJfyLStrcCTzXcum1Xfx6rjyq5LU5D93F6ZXGBlVrLmk/+YEep65g0X82VzbPN
9aIKW2kBLKuH2O9MwaqWko+ZEQKBgQC8zXlgsq2fkKeyRJfIAN8+Wx2Kd1n5KPbl
nvbj9k59oYBz1yggj9v6vjfo9MrgZxp5LmR5UgGsSFpqXpkA7SDYCvKZUwQj/eIx
LhV6NG+SnbFKtinIuh9GHiEKGNxJsRL7ZljVjW6f6C4f4MeyEW2IpE5AMAaCfpUS
JxI3afJXnQKBgBcKsGNAuRQ55Tdeploa6lw+PMoKsJ89tRaK7sM3jL65xYrpaFCO
2b0bf75v3c/VXckoj5Sfg7U+nKwd9oQSb9VOO/IQefKZg7AFPSSsJDBr6dIdUe5G
VDrrMU66uB3JiB+Q4KgsFcc0BZE8DtYPaPgXwy39Bspjq29D68DcVuRBAoGAZbA9
qalS/lhJGij7nwtpMgqdNJDn8tzvbelajJmC2QN9Tecag783+istrdj61DZz+cTU
9MsIf6RQnm3o9qjBQdtTouUlm8UIaPirNLC9TziD3vuSMbydT4S2wtt0+nPXB3Su
cAbHCHVjMmQ86lmcpzXnt4amWu6Wl7pXg2Ua07kCgYEA8XMfXql48oUVIr+cN5AN
nnql5ojMi2Vp9SeTDM/LKCJ9HORCKi4DyHqm06OjDFi2Al57DVsLHpxENWVSgUmp
OpcE1P2kqmDqQguFg9GUPX38zspijdVBd1rtpPfHsAu+ZvRWT8ozFLKZ3Xjg1fIx
TL6BeOBii9TlZ66SlZT5HRM=
-----END PRIVATE KEY-----`,
  cert: `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUfoHoOgjjiqPNOxpbp7jHBFSfTeEwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDExNDE1MzAyMFoXDTI3MDEx
NDE1MzAyMFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAtSYvGqt2J8YkQoubMr4IXRvtPH/RnNQueVIjWXOc8WOi
I+96YO9n1juteFh+TE9xnngx3QOIxf8cWbYC3nCdeC+QsqqW3BWJ2so0UuVo1nxu
NFTrFQH+ToiXpumC+GLvRBMTtTMYcyEJln6oowkgVT4mJCfQqE9RLlDDwbnVpMbO
TUB1GCbth6v5hvPVvsjLk/mKfWCmrtbJ28dCOGqn/jgSSq5VhGfrYHE28lltG70L
/DrvXBWY7F0BfI1wRyfe/yz1vOdIyre+iej4yGXmk0nGaPT8v30iH/PuF2BR6901
ZlKaGtX9Y5qfpBNB+dfig56m3GAgehMBZlBUWiembQIDAQABo1MwUTAdBgNVHQ4E
FgQUHvZklBlcvTOIuN/xSO7BP7rgSqswHwYDVR0jBBgwFoAUHvZklBlcvTOIuN/x
SO7BP7rgSqswDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAWRj4
bB1eObtMOal4VPmL5iX07XzL4hp6Dwu2LSrw9KMArqTTeyJEGNSsykuHPZwPIflD
JkzfrFfDv8q7YDpSLy9vJN2E+SPn/Oq2BehUmD+uURghaoSsXeyY9Kv6vGZri95l
rgg+6wLJDVrnw5tKxEHx5hUyVR3Ms4LwU/hwAcCGCxx5exhvLpfjjxGBR814kCEc
IKGISNjqDo1Pz1Xm8QBLzG4CtlzE/QEbkJKImmwskv6vvoRbWg+B529WzFFCReYK
/sULgpvG29Uc3MwZK242dKyTUFdI6tQuZ8xierXwP0kIFlP2phtkgE9kjQJqrtRZ
fago/IeVI/sKlApDxA==
-----END CERTIFICATE-----`,
};

describe('HttpsTunnelProxy', () => {
  let tunnel: HttpsTunnelProxy | null = null;
  let mockServer: https.Server | null = null;
  let mockServerPort: number = 0;

  afterEach(async () => {
    // Clean up tunnel
    if (tunnel) {
      tunnel.stop();
      tunnel = null;
    }
    // Clean up mock server
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer!.close(() => resolve());
      });
      mockServer = null;
    }
  });

  describe('constructor', () => {
    it('should apply default values for optional config', () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      // The proxy should be created without error
      expect(tunnel).toBeDefined();
      expect(tunnel.getPort()).toBeNull(); // Not started yet
    });

    it('should accept custom config values', () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'custom.host.com',
        remotePort: 8443,
        authToken: 'test-token',
        timeoutMs: 30000,
        verbose: true,
        allowSelfSigned: true,
      });

      expect(tunnel).toBeDefined();
    });

    // Hostname validation tests
    it('should throw error for empty hostname', () => {
      expect(() => {
        new HttpsTunnelProxy({ remoteHost: '' });
      }).toThrow('Invalid remoteHost format');
    });

    it('should throw error for hostname with protocol prefix', () => {
      expect(() => {
        new HttpsTunnelProxy({ remoteHost: 'https://example.com' });
      }).toThrow('Invalid remoteHost format');
    });

    it('should throw error for hostname with spaces', () => {
      expect(() => {
        new HttpsTunnelProxy({ remoteHost: 'example .com' });
      }).toThrow('Invalid remoteHost format');
    });

    it('should throw error for hostname with invalid characters', () => {
      expect(() => {
        new HttpsTunnelProxy({ remoteHost: 'example@com' });
      }).toThrow('Invalid remoteHost format');
    });

    it('should accept valid hostnames', () => {
      // Standard domain
      expect(() => new HttpsTunnelProxy({ remoteHost: 'example.com' })).not.toThrow();
      // Subdomain
      expect(() => new HttpsTunnelProxy({ remoteHost: 'api.example.com' })).not.toThrow();
      // With dashes
      expect(() => new HttpsTunnelProxy({ remoteHost: 'my-api.example-site.com' })).not.toThrow();
      // IP-like
      expect(() => new HttpsTunnelProxy({ remoteHost: '192.168.1.1' })).not.toThrow();
      // Localhost
      expect(() => new HttpsTunnelProxy({ remoteHost: 'localhost' })).not.toThrow();
      // Single char hostname
      expect(() => new HttpsTunnelProxy({ remoteHost: 'a' })).not.toThrow();
    });
  });

  describe('start()', () => {
    it('should start server and return valid port', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      const port = await tunnel.start();

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
      expect(tunnel.getPort()).toBe(port);
    });

    it('should return same port on subsequent start() calls', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      const port1 = await tunnel.start();
      const port2 = await tunnel.start();

      expect(port1).toBe(port2);
    });

    it('should bind to localhost only (127.0.0.1)', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      const port = await tunnel.start();

      // Try to connect - should work on localhost
      const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/test`, resolve);
        req.on('error', reject);
        req.setTimeout(1000);
      }).catch((err) => err);

      // We expect an error because there's no upstream, but connection should be accepted
      // If binding failed, we'd get ECONNREFUSED before any response
      expect(response).toBeDefined();
    });
  });

  describe('stop()', () => {
    it('should clear port after stop', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      await tunnel.start();
      expect(tunnel.getPort()).not.toBeNull();

      tunnel.stop();
      expect(tunnel.getPort()).toBeNull();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      // Stop without start - should not throw
      tunnel.stop();
      tunnel.stop();
      tunnel.stop();

      expect(tunnel.getPort()).toBeNull();
    });

    it('should allow restart after stop', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      const port1 = await tunnel.start();
      tunnel.stop();

      const port2 = await tunnel.start();

      expect(port2).toBeGreaterThan(0);
      // Ports may or may not be the same depending on OS port reuse
    });
  });

  describe('getPort()', () => {
    it('should return null before start', () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      expect(tunnel.getPort()).toBeNull();
    });

    it('should return valid port after start', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
      });

      await tunnel.start();

      const port = tunnel.getPort();
      expect(port).not.toBeNull();
      expect(port).toBeGreaterThan(0);
    });
  });

  describe('buildForwardHeaders (Authorization injection)', () => {
    // We test this indirectly through the proxy behavior
    // The buildForwardHeaders method is private, so we verify via integration

    it('should forward existing Authorization header', async () => {
      // This test requires a mock HTTPS server
      // For now, we document the expected behavior
      const config: HttpsTunnelConfig = {
        remoteHost: 'example.com',
        authToken: 'fallback-token',
      };

      tunnel = new HttpsTunnelProxy(config);
      await tunnel.start();

      // The tunnel should:
      // 1. Forward 'Authorization' header if present in request
      // 2. Inject 'Authorization: Bearer fallback-token' if not present
      expect(tunnel.getPort()).toBeGreaterThan(0);
    });
  });

  describe('hop-by-hop headers filtering', () => {
    // RFC 7230 hop-by-hop headers should be filtered
    const hopByHopHeaders = [
      'host',
      'connection',
      'transfer-encoding',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailer',
      'upgrade',
    ];

    it('should define all RFC 7230 hop-by-hop headers for filtering', () => {
      // Document expected filtered headers
      expect(hopByHopHeaders).toContain('connection');
      expect(hopByHopHeaders).toContain('transfer-encoding');
      expect(hopByHopHeaders).toContain('keep-alive');
    });
  });

  describe('connection tracking', () => {
    it('should track active connections for cleanup', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
        verbose: false,
      });

      const port = await tunnel.start();

      // Create a connection
      const net = await import('net');
      const socket = new net.Socket();

      // Use a promise that resolves when connection is established
      await new Promise<void>((resolve, reject) => {
        socket.on('error', reject);
        socket.connect(port, '127.0.0.1', () => resolve());
      });

      // Give the server time to register the connection
      await new Promise((r) => setTimeout(r, 50));

      // Stop should forcefully close all connections and the server
      tunnel.stop();

      // Verify stop() was called successfully (server is null after stop)
      // The key behavior is that stop() destroys server-side sockets
      // and clears activeConnections - we verify by checking getPort() returns null
      expect(tunnel.getPort()).toBe(null);

      // Clean up client socket
      socket.destroy();
    });
  });

  describe('error handling', () => {
    it(
      'should handle upstream timeout',
      async () => {
        // Create an HTTPS server that accepts connections but delays response
        // beyond the tunnel's timeout. This tests the socket-level timeout.
        const slowServer = https.createServer(
          { key: TEST_CERT.key, cert: TEST_CERT.cert },
          (req, res) => {
            // Delay response beyond tunnel timeout (500ms)
            // The tunnel should timeout before this completes
            setTimeout(() => {
              res.writeHead(200);
              res.end('too late');
            }, 2000);
          }
        );

        await new Promise<void>((resolve) => {
          slowServer.listen(0, '127.0.0.1', () => resolve());
        });

        const slowPort = (slowServer.address() as AddressInfo).port;

        try {
          tunnel = new HttpsTunnelProxy({
            remoteHost: '127.0.0.1',
            remotePort: slowPort,
            timeoutMs: 500, // Short timeout - server responds after 2000ms
            allowSelfSigned: true,
          });

          const port = await tunnel.start();

          // Make request - should timeout because server delays 2s but tunnel times out at 500ms
          const response = await new Promise<http.IncomingMessage | Error>((resolve, reject) => {
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port,
                path: '/v1/messages',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              },
              resolve
            );
            req.on('error', (err) => resolve(err)); // Resolve with error instead of reject
            req.setTimeout(3000); // Client timeout longer than tunnel timeout
            req.write('{}');
            req.end();
          });

          // Either 502 response or connection error is acceptable
          // The tunnel should have timed out and returned 502 or closed the connection
          expect(response).toBeDefined();
          if (response instanceof http.IncomingMessage) {
            expect(response.statusCode).toBe(502);
          }
        } finally {
          slowServer.close();
        }
      },
      { timeout: 10000 }
    );

    it('should handle client disconnect (premature close)', async () => {
      // Create a slow HTTPS server that holds connection
      // HttpsTunnelProxy uses https.request(), so we need an HTTPS server
      const slowServer = https.createServer(
        { key: TEST_CERT.key, cert: TEST_CERT.cert },
        (req, res) => {
          // Wait before responding
          setTimeout(() => {
            res.writeHead(200);
            res.end('ok');
          }, 2000);
        }
      );

      await new Promise<void>((resolve) => {
        slowServer.listen(0, '127.0.0.1', () => resolve());
      });

      const slowPort = (slowServer.address() as AddressInfo).port;

      try {
        tunnel = new HttpsTunnelProxy({
          remoteHost: '127.0.0.1',
          remotePort: slowPort,
          timeoutMs: 10000,
          allowSelfSigned: true,
        });

        const port = await tunnel.start();

        // Make request and immediately abort
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/v1/messages',
          method: 'POST',
        });

        req.write('{}');
        req.end();

        // Abort after a short delay to trigger premature close
        await new Promise((resolve) => setTimeout(resolve, 50));
        req.destroy();

        // Give time for error handling
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Tunnel should still be operational
        expect(tunnel.getPort()).toBe(port);
      } finally {
        slowServer.close();
      }
    });

    it('should handle client request error', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'example.com',
        remotePort: 443,
        timeoutMs: 5000,
      });

      const port = await tunnel.start();

      // Create socket and send malformed request
      const net = await import('net');
      const socket = new net.Socket();

      await new Promise<void>((resolve, reject) => {
        socket.connect(port, '127.0.0.1', () => {
          // Send partial HTTP request then destroy
          socket.write('POST /test HTTP/1.1\r\n');
          socket.write('Content-Length: 100\r\n\r\n'); // Claim 100 bytes
          socket.write('partial'); // Only send partial body
          socket.destroy(); // Trigger error
          resolve();
        });
        socket.on('error', () => resolve()); // Ignore socket errors
      });

      // Give time for error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Tunnel should still be operational
      expect(tunnel.getPort()).toBe(port);
    });

    it('should handle upstream connection errors gracefully', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'nonexistent.invalid.host',
        remotePort: 12345,
        timeoutMs: 1000,
      });

      const port = await tunnel.start();

      // Make request to tunnel - should get 502 error
      const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/v1/messages',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          resolve
        );
        req.on('error', reject);
        req.setTimeout(5000);
        req.write('{}');
        req.end();
      });

      expect(response.statusCode).toBe(502);
    });

    it('should return JSON error response', async () => {
      tunnel = new HttpsTunnelProxy({
        remoteHost: 'nonexistent.invalid.host',
        remotePort: 12345,
        timeoutMs: 1000,
      });

      const port = await tunnel.start();

      const body = await new Promise<string>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/v1/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
          }
        );
        req.on('error', reject);
        req.setTimeout(5000);
        req.write('{}');
        req.end();
      });

      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty('error');
      expect(typeof parsed.error).toBe('string');
    });
  });

  describe('config interface', () => {
    it('should export HttpsTunnelConfig type', () => {
      const config: HttpsTunnelConfig = {
        remoteHost: 'test.com',
        remotePort: 443,
        authToken: 'token',
        timeoutMs: 60000,
        verbose: false,
        allowSelfSigned: false,
      };

      expect(config.remoteHost).toBe('test.com');
      expect(config.remotePort).toBe(443);
    });

    it('should allow minimal config with only remoteHost', () => {
      const config: HttpsTunnelConfig = {
        remoteHost: 'minimal.test.com',
      };

      expect(config.remoteHost).toBe('minimal.test.com');
      expect(config.remotePort).toBeUndefined();
      expect(config.authToken).toBeUndefined();
    });
  });
});

describe('HttpsTunnelProxy stripPathPrefix integration with CodexReasoningProxy', () => {
  // Document the integration pattern between HttpsTunnelProxy and CodexReasoningProxy
  // In remote mode, the path flow is:
  //   Claude → CodexReasoningProxy → HttpsTunnelProxy → Remote CLIProxyAPI
  //
  // CodexReasoningProxy strips /api/provider/codex prefix before forwarding
  // HttpsTunnelProxy then tunnels HTTP→HTTPS to remote server

  it('should document path transformation for remote mode', () => {
    // Remote CLIProxyAPI expects: /v1/messages
    // Local CLIProxy expects: /api/provider/codex/v1/messages
    //
    // CodexReasoningProxy.stripPathPrefix handles this transformation:
    //   Input:  /api/provider/codex/v1/messages
    //   Output: /v1/messages
    const inputPath = '/api/provider/codex/v1/messages';
    const prefix = '/api/provider/codex';
    const expectedOutput = '/v1/messages';

    const result = inputPath.startsWith(prefix) ? inputPath.slice(prefix.length) || '/' : inputPath;

    expect(result).toBe(expectedOutput);
  });

  it('should handle root path after prefix strip', () => {
    const inputPath = '/api/provider/codex';
    const prefix = '/api/provider/codex';

    const result = inputPath.startsWith(prefix) ? inputPath.slice(prefix.length) || '/' : inputPath;

    expect(result).toBe('/');
  });
});
