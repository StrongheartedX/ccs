/**
 * WebSocket Handler (Phase 04)
 *
 * Stub for WebSocket message handling - will be implemented in Phase 04.
 */

import { WebSocket } from 'ws';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

/**
 * Handle WebSocket messages (Phase 04)
 */
export function handleWebSocketMessage(_ws: WebSocket, message: WebSocketMessage): void {
  // Will be implemented in Phase 04
  console.log('[i] WebSocket message received:', message.type);
}

/**
 * Broadcast message to all connected clients (Phase 04)
 */
export function broadcast(clients: Set<WebSocket>, message: WebSocketMessage): void {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
