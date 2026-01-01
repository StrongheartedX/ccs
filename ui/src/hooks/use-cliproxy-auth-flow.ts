/**
 * OAuth Auth Flow Hook for CLIProxy
 * Triggers backend-managed OAuth authentication flows
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

interface AuthFlowState {
  provider: string | null;
  isAuthenticating: boolean;
  error: string | null;
}

const VALID_PROVIDERS = ['gemini', 'codex', 'agy', 'qwen', 'iflow', 'kiro', 'ghcp'];

export function useCliproxyAuthFlow() {
  const [state, setState] = useState<AuthFlowState>({
    provider: null,
    isAuthenticating: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startAuth = useCallback(
    async (provider: string) => {
      if (!VALID_PROVIDERS.includes(provider)) {
        setState({
          provider: null,
          isAuthenticating: false,
          error: `Unknown provider: ${provider}`,
        });
        return;
      }

      // Abort any in-progress auth
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setState({ provider, isAuthenticating: true, error: null });

      try {
        // POST to CCS auth endpoint - backend opens browser and waits
        const response = await fetch(`/api/cliproxy/auth/${provider}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: abortControllerRef.current.signal,
        });

        const data = await response.json();

        if (response.ok && data.success) {
          queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
          queryClient.invalidateQueries({ queryKey: ['account-quota'] });
          toast.success(`${provider} authentication successful`);
          setState({ provider: null, isAuthenticating: false, error: null });
        } else {
          throw new Error(data.error || 'Authentication failed');
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setState({ provider: null, isAuthenticating: false, error: null });
          return;
        }
        const message = error instanceof Error ? error.message : 'Authentication failed';
        toast.error(message);
        setState({ provider: null, isAuthenticating: false, error: message });
      }
    },
    [queryClient]
  );

  const cancelAuth = useCallback(() => {
    const currentProvider = state.provider;
    abortControllerRef.current?.abort();
    setState({ provider: null, isAuthenticating: false, error: null });
    // Also cancel on backend
    if (currentProvider) {
      api.cliproxy.auth.cancel(currentProvider).catch(() => {
        // Ignore errors - session may have already completed
      });
    }
  }, [state.provider]);

  return useMemo(
    () => ({
      ...state,
      startAuth,
      cancelAuth,
    }),
    [state, startAuth, cancelAuth]
  );
}
