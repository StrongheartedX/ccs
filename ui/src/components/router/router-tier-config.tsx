/**
 * Router Tier Config - Configure single tier (opus/sonnet/haiku)
 * Supports fallback chains with warning when depth > 5
 * Shows visual indicator for unconfigured state
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, CircleDashed } from 'lucide-react';
import { RouterProviderPicker } from './router-provider-picker';
import type { TierConfig, RouterProvider } from '@/lib/router-types';

interface RouterTierConfigProps {
  tier: 'opus' | 'sonnet' | 'haiku';
  config: TierConfig;
  providers: RouterProvider[];
  onChange: (config: TierConfig) => void;
}

export function RouterTierConfig({ tier, config, providers, onChange }: RouterTierConfigProps) {
  const [showFallbacks, setShowFallbacks] = useState(false);

  const handlePrimaryChange = (value: { provider: string; model: string }) => {
    onChange({ ...config, provider: value.provider, model: value.model });
  };

  const addFallback = () => {
    const fallbacks = config.fallback ?? [];
    onChange({
      ...config,
      fallback: [...fallbacks, { provider: '', model: '' }],
    });
    setShowFallbacks(true);
  };

  const updateFallback = (index: number, value: TierConfig) => {
    const fallbacks = [...(config.fallback ?? [])];
    fallbacks[index] = value;
    onChange({ ...config, fallback: fallbacks });
  };

  const removeFallback = (index: number) => {
    const fallbacks = (config.fallback ?? []).filter((_, i) => i !== index);
    onChange({ ...config, fallback: fallbacks.length ? fallbacks : undefined });
  };

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const fallbackCount = config.fallback?.length ?? 0;
  const showDepthWarning = fallbackCount > 5;
  const isUnconfigured = !config.provider || !config.model;

  return (
    <div
      className={`space-y-3 p-4 border rounded-lg transition-colors ${
        isUnconfigured ? 'border-dashed border-yellow-500/40 bg-yellow-500/5' : 'border-solid'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{tierLabel}</Label>
          {isUnconfigured && (
            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/50">
              <CircleDashed className="w-3 h-3 mr-1" />
              Not configured
            </Badge>
          )}
          {showDepthWarning && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Deep chain ({fallbackCount})
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={addFallback}>
          <Plus className="w-4 h-4 mr-1" />
          Fallback
        </Button>
      </div>

      <RouterProviderPicker
        providers={providers}
        value={{ provider: config.provider, model: config.model }}
        onChange={handlePrimaryChange}
      />

      {config.fallback && config.fallback.length > 0 && (
        <div className="ml-4 space-y-2">
          <button
            className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowFallbacks(!showFallbacks)}
          >
            {showFallbacks ? (
              <ChevronDown className="w-3 h-3 mr-1" />
            ) : (
              <ChevronRight className="w-3 h-3 mr-1" />
            )}
            {fallbackCount} fallback{fallbackCount !== 1 ? 's' : ''}
          </button>

          {showFallbacks &&
            config.fallback.map((fb, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                <div className="flex-1">
                  <RouterProviderPicker
                    providers={providers}
                    value={{ provider: fb.provider, model: fb.model }}
                    onChange={(val) =>
                      updateFallback(i, { provider: val.provider, model: val.model })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFallback(i)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
