/**
 * Router Provider Picker - Select provider + model with health status
 * CLIProxy providers get dropdown (from catalog), settings profiles get text input
 */

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { RouterProvider } from '@/lib/router-types';
import { MODEL_CATALOGS } from '@/lib/model-catalogs';

interface RouterProviderPickerProps {
  providers: RouterProvider[];
  value: { provider: string; model: string };
  onChange: (value: { provider: string; model: string }) => void;
}

export function RouterProviderPicker({ providers, value, onChange }: RouterProviderPickerProps) {
  const selectedProvider = useMemo(
    () => providers.find((p) => p.name === value.provider),
    [providers, value.provider]
  );

  // Check if provider has a model catalog (CLIProxy) vs settings profile (no catalog)
  const hasCatalog = useMemo(() => {
    return !!MODEL_CATALOGS[value.provider];
  }, [value.provider]);

  // Get models for selected provider from catalog
  const providerModels = useMemo(() => {
    if (!value.provider) return [];
    const catalog = MODEL_CATALOGS[value.provider];
    return catalog?.models ?? [];
  }, [value.provider]);

  // Handle provider change - auto-select default model for catalog providers, clear for settings
  const handleProviderChange = (provider: string) => {
    const catalog = MODEL_CATALOGS[provider];
    const defaultModel = catalog?.defaultModel ?? '';
    onChange({ provider, model: defaultModel });
  };

  return (
    <div className="flex gap-2">
      {/* Provider dropdown */}
      <Select value={value.provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              <div className="flex items-center gap-2">
                {p.healthy ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
                <span>{p.name}</span>
                {p.latency !== undefined && p.latency > 0 && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {p.latency}ms
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Model selector - dropdown for catalog providers, text input for settings profiles */}
      {hasCatalog ? (
        <Select
          value={value.model}
          onValueChange={(model) => onChange({ ...value, model })}
          disabled={!value.provider}
        >
          <SelectTrigger className="flex-1 min-w-[280px]">
            <SelectValue placeholder={value.provider ? 'Select model' : 'Select provider first'} />
          </SelectTrigger>
          <SelectContent>
            {providerModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-mono text-sm">{m.id}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
          placeholder={value.provider ? 'Enter model name' : 'Select provider first'}
          disabled={!value.provider}
          className="flex-1 min-w-[280px] font-mono text-sm"
        />
      )}

      {/* Show health error if provider unhealthy */}
      {selectedProvider && !selectedProvider.healthy && selectedProvider.error && (
        <span className="text-xs text-destructive self-center truncate max-w-[120px]">
          {selectedProvider.error}
        </span>
      )}
    </div>
  );
}
