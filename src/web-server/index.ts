/**
 * CCS Config Dashboard - Web Server
 *
 * Express server with WebSocket support for real-time config management.
 * Single HTTP server handles REST API, static files, and WebSocket connections.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';

export interface ServerOptions {
  port: number;
  staticDir?: string;
}

export interface ServerInstance {
  server: http.Server;
  wss: WebSocketServer;
}

/**
 * Start Express server with WebSocket support
 */
export async function startServer(options: ServerOptions): Promise<ServerInstance> {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // JSON body parsing
  app.use(express.json());

  // REST API routes (Phase 03)
  // app.use('/api', apiRoutes);

  // Static files (dist/ui/)
  const staticDir = options.staticDir || path.join(__dirname, '../../dist/ui');
  app.use(express.static(staticDir));

  // SPA fallback - return index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  // WebSocket connection handler (stub for Phase 04)
  wss.on('connection', (ws) => {
    console.log('[i] WebSocket client connected');

    ws.on('close', () => {
      console.log('[i] WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[!] WebSocket error:', error.message);
    });
  });

  // Start listening
  return new Promise<ServerInstance>((resolve) => {
    server.listen(options.port, () => {
      resolve({ server, wss });
    });
  });
}
