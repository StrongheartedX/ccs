import type { ProviderAdapter, AnthropicRequest, AnthropicResponse } from './base';
import type { ResolvedProvider } from '../providers/types';

/**
 * Anthropic passthrough adapter
 * Used for CLIProxy providers (agy, gemini, codex, etc.)
 * which already return Anthropic-compatible responses
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly adapterType = 'anthropic' as const;

  transformRequest(
    req: AnthropicRequest,
    targetModel: string,
    _provider: ResolvedProvider
  ): AnthropicRequest {
    // Only change is updating the model name
    return {
      ...req,
      model: targetModel,
    };
  }

  transformResponse(res: unknown): AnthropicResponse {
    // Passthrough - already in Anthropic format
    return res as AnthropicResponse;
  }

  transformStreamChunk(chunk: unknown): string {
    // Passthrough - already in Anthropic SSE format
    return chunk as string;
  }

  getHeaders(provider: ResolvedProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (provider.authToken) {
      headers['Authorization'] = `Bearer ${provider.authToken}`;
    }

    // Merge any custom headers
    if (provider.headers) {
      Object.assign(headers, provider.headers);
    }

    return headers;
  }

  getEndpoint(provider: ResolvedProvider): string {
    // Anthropic API requires /v1/messages endpoint
    // Base URLs may or may not include /v1, so we need to handle both cases
    const baseUrl = provider.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    if (baseUrl.endsWith('/v1')) {
      return `${baseUrl}/messages`;
    }
    return `${baseUrl}/v1/messages`;
  }
}

// Singleton instance
export const anthropicAdapter = new AnthropicAdapter();
