/**
 * Auth Session Manager
 *
 * Tracks active OAuth sessions and provides cancellation capability.
 * Used to properly terminate in-progress OAuth flows from UI.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';

export interface ActiveAuthSession {
  sessionId: string;
  provider: string;
  startedAt: number;
  process?: ChildProcess;
}

export const authSessionEvents = new EventEmitter();

const activeSessions = new Map<string, ActiveAuthSession>();

/**
 * Register an active OAuth session
 */
export function registerAuthSession(
  sessionId: string,
  provider: string,
  process?: ChildProcess
): void {
  activeSessions.set(sessionId, {
    sessionId,
    provider,
    startedAt: Date.now(),
    process,
  });
  authSessionEvents.emit('session:started', sessionId, provider);
}

/**
 * Update session with process reference (if registered before spawn)
 */
export function attachProcessToSession(sessionId: string, process: ChildProcess): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.process = process;
  }
}

/**
 * Unregister an auth session (on completion or cancellation)
 */
export function unregisterAuthSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  authSessionEvents.emit('session:ended', sessionId);
}

/**
 * Cancel an active OAuth session
 * Returns true if session was found and killed
 */
export function cancelAuthSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return false;
  }

  // Kill the process if attached
  if (session.process && !session.process.killed) {
    session.process.kill('SIGTERM');
  }

  activeSessions.delete(sessionId);
  authSessionEvents.emit('session:cancelled', sessionId);
  return true;
}

/**
 * Get active session by session ID
 */
export function getActiveSession(sessionId: string): ActiveAuthSession | null {
  return activeSessions.get(sessionId) || null;
}

/**
 * Get active session for a provider (most recent)
 */
export function getActiveSessionForProvider(provider: string): ActiveAuthSession | null {
  for (const session of activeSessions.values()) {
    if (session.provider === provider) {
      return session;
    }
  }
  return null;
}

/**
 * Check if there's an active session for provider
 */
export function hasActiveSession(provider: string): boolean {
  return getActiveSessionForProvider(provider) !== null;
}

/**
 * Cancel all sessions for a provider
 */
export function cancelAllSessionsForProvider(provider: string): number {
  let count = 0;
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.provider === provider) {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
      activeSessions.delete(sessionId);
      authSessionEvents.emit('session:cancelled', sessionId);
      count++;
    }
  }
  return count;
}
