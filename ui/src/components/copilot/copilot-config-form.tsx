/**
 * Copilot Config Form
 *
 * Form for configuring GitHub Copilot integration settings.
 * Split-view layout matching CLIProxy provider editor:
 * - Left (50%): Friendly UI with model mapping selectors
 * - Right (50%): Raw JSON editor for copilot.settings.json
 */

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { useCopilot, type CopilotModel, type CopilotPlanTier } from '@/hooks/use-copilot';
import { Loader2, Save, Code2, X, Info, RefreshCw, Sparkles, Zap, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

// Lazy load CodeEditor
const CodeEditor = lazy(() =>
  import('@/components/code-editor').then((m) => ({ default: m.CodeEditor }))
);

// Model presets for quick configuration
// Grouped by tier: Free (available to all) and Paid (requires Pro+)
// Note: ALL Claude models require paid Copilot subscription
const FREE_PRESETS = [
  {
    name: 'GPT-4.1 (Free)',
    description: 'Free tier - no premium usage',
    default: 'gpt-4.1',
    opus: 'gpt-4.1',
    sonnet: 'gpt-4.1',
    haiku: 'gpt-4.1',
  },
  {
    name: 'GPT-5 Mini (Free)',
    description: 'Free tier - lightweight model',
    default: 'gpt-5-mini',
    opus: 'gpt-5-mini',
    sonnet: 'gpt-5-mini',
    haiku: 'gpt-5-mini',
  },
  {
    name: 'Raptor Mini (Free)',
    description: 'Free tier - fine-tuned for coding',
    default: 'raptor-mini',
    opus: 'raptor-mini',
    sonnet: 'raptor-mini',
    haiku: 'raptor-mini',
  },
];

const PAID_PRESETS = [
  {
    name: 'Claude Opus 4.5',
    description: 'Pro+ (3x) - Most capable reasoning',
    default: 'claude-opus-4.5',
    opus: 'claude-opus-4.5',
    sonnet: 'claude-sonnet-4.5',
    haiku: 'claude-haiku-4.5',
  },
  {
    name: 'Claude Sonnet 4.5',
    description: 'Pro+ (1x) - Balanced performance',
    default: 'claude-sonnet-4.5',
    opus: 'claude-opus-4.5',
    sonnet: 'claude-sonnet-4.5',
    haiku: 'claude-haiku-4.5',
  },
  {
    name: 'GPT-5.2',
    description: 'Pro+ (1x) - Latest OpenAI (Preview)',
    default: 'gpt-5.2',
    opus: 'gpt-5.2',
    sonnet: 'gpt-5.1',
    haiku: 'gpt-5-mini',
  },
  {
    name: 'GPT-5.1 Codex Max',
    description: 'Pro+ (1x) - Best for coding',
    default: 'gpt-5.1-codex-max',
    opus: 'gpt-5.1-codex-max',
    sonnet: 'gpt-5.1-codex',
    haiku: 'gpt-5.1-codex-mini',
  },
  {
    name: 'Gemini 2.5 Pro',
    description: 'Pro+ (1x) - Google latest',
    default: 'gemini-2.5-pro',
    opus: 'gemini-2.5-pro',
    sonnet: 'gemini-2.5-pro',
    haiku: 'gemini-3-flash',
  },
];

interface FlexibleModelSelectorProps {
  label: string;
  description?: string;
  value: string | undefined;
  onChange: (model: string) => void;
  models: CopilotModel[];
  disabled?: boolean;
}

/** Get badge style for plan tier */
function getPlanBadgeStyle(plan?: CopilotPlanTier): string {
  switch (plan) {
    case 'free':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'pro':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'pro+':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'business':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'enterprise':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/** Get multiplier display */
function getMultiplierDisplay(multiplier?: number): string | null {
  if (multiplier === undefined || multiplier === null) return null;
  if (multiplier === 0) return 'Free';
  if (multiplier < 1) return `${multiplier}x`;
  if (multiplier === 1) return '1x';
  return `${multiplier}x`;
}

function FlexibleModelSelector({
  label,
  description,
  value,
  onChange,
  models,
  disabled,
}: FlexibleModelSelectorProps) {
  // Find current model for display
  const currentModel = models.find((m) => m.id === value);

  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-xs font-medium">{label}</label>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select model">
            {value && (
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-xs">{value}</span>
                {currentModel?.minPlan && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 h-4 ${getPlanBadgeStyle(currentModel.minPlan)}`}
                  >
                    {currentModel.minPlan}
                  </Badge>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground">
              Available Models ({models.length})
            </SelectLabel>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{model.name || model.id}</span>
                  {model.minPlan && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 h-4 ${getPlanBadgeStyle(model.minPlan)}`}
                    >
                      {model.minPlan}
                    </Badge>
                  )}
                  {model.multiplier !== undefined && (
                    <span className="text-[9px] text-muted-foreground">
                      {getMultiplierDisplay(model.multiplier)}
                    </span>
                  )}
                  {model.preview && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      Preview
                    </Badge>
                  )}
                  {value === model.id && <Check className="w-3 h-3 text-primary ml-auto" />}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function CopilotConfigForm() {
  const {
    config,
    configLoading,
    models,
    modelsLoading,
    rawSettings,
    rawSettingsLoading,
    updateConfigAsync,
    isUpdating,
    saveRawSettingsAsync,
    isSavingRawSettings,
    refetchRawSettings,
  } = useCopilot();

  // Track local overrides for form fields
  const [localOverrides, setLocalOverrides] = useState<{
    enabled?: boolean;
    autoStart?: boolean;
    port?: number;
    accountType?: 'individual' | 'business' | 'enterprise';
    model?: string;
    rateLimit?: string;
    waitOnLimit?: boolean;
    opusModel?: string;
    sonnetModel?: string;
    haikuModel?: string;
  }>({});

  // Raw JSON editor state
  const [rawJsonEdits, setRawJsonEdits] = useState<string | null>(null);
  const [conflictDialog, setConflictDialog] = useState(false);

  // Use local overrides if set, otherwise use config values
  const enabled = localOverrides.enabled ?? config?.enabled ?? false;
  const autoStart = localOverrides.autoStart ?? config?.auto_start ?? false;
  const port = localOverrides.port ?? config?.port ?? 4141;
  const accountType = localOverrides.accountType ?? config?.account_type ?? 'individual';
  const currentModel = localOverrides.model ?? config?.model ?? 'claude-opus-4-5-20250514';
  const rateLimit = localOverrides.rateLimit ?? config?.rate_limit?.toString() ?? '';
  const waitOnLimit = localOverrides.waitOnLimit ?? config?.wait_on_limit ?? true;
  const opusModel = localOverrides.opusModel ?? config?.opus_model ?? '';
  const sonnetModel = localOverrides.sonnetModel ?? config?.sonnet_model ?? '';
  const haikuModel = localOverrides.haikuModel ?? config?.haiku_model ?? '';

  const updateField = <K extends keyof typeof localOverrides>(
    key: K,
    value: (typeof localOverrides)[K]
  ) => {
    setLocalOverrides((prev) => ({ ...prev, [key]: value }));
  };

  // Batch update for presets
  const applyPreset = (preset: (typeof FREE_PRESETS)[0] | (typeof PAID_PRESETS)[0]) => {
    setLocalOverrides((prev) => ({
      ...prev,
      model: preset.default,
      opusModel: preset.opus,
      sonnetModel: preset.sonnet,
      haikuModel: preset.haiku,
    }));
    toast.success(`Applied "${preset.name}" preset`);
  };

  // Raw JSON content
  const rawJsonContent = useMemo(() => {
    if (rawJsonEdits !== null) return rawJsonEdits;
    if (rawSettings?.settings) return JSON.stringify(rawSettings.settings, null, 2);
    return '{\n  "env": {}\n}';
  }, [rawJsonEdits, rawSettings]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJsonEdits(value);
  }, []);

  // Check if JSON is valid
  const isRawJsonValid = useMemo(() => {
    try {
      JSON.parse(rawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [rawJsonContent]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    const hasLocalChanges = Object.keys(localOverrides).length > 0;
    const hasJsonChanges =
      rawJsonEdits !== null && rawJsonEdits !== JSON.stringify(rawSettings?.settings, null, 2);
    return hasLocalChanges || hasJsonChanges;
  }, [localOverrides, rawJsonEdits, rawSettings]);

  const handleSave = async () => {
    try {
      // Save config changes
      if (Object.keys(localOverrides).length > 0) {
        await updateConfigAsync({
          enabled,
          auto_start: autoStart,
          port,
          account_type: accountType,
          model: currentModel,
          rate_limit: rateLimit ? parseInt(rateLimit, 10) : null,
          wait_on_limit: waitOnLimit,
          opus_model: opusModel || undefined,
          sonnet_model: sonnetModel || undefined,
          haiku_model: haikuModel || undefined,
        });
      }

      // Save raw JSON changes
      if (rawJsonEdits !== null && isRawJsonValid) {
        const settingsToSave = JSON.parse(rawJsonContent);
        await saveRawSettingsAsync({
          settings: settingsToSave,
          expectedMtime: rawSettings?.mtime,
        });
      }

      // Clear local state
      setLocalOverrides({});
      setRawJsonEdits(null);
      toast.success('Copilot configuration saved');
    } catch (error) {
      if ((error as Error).message === 'CONFLICT') {
        setConflictDialog(true);
      } else {
        toast.error('Failed to save settings');
      }
    }
  };

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      await refetchRawSettings();
      handleSave();
    } else {
      setRawJsonEdits(null);
    }
  };

  if (configLoading || rawSettingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Left column: Friendly UI
  const renderFriendlyUI = () => (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="config" className="h-full flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="config" className="flex-1">
              Model Config
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              Settings
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Model Config Tab */}
          <TabsContent
            value="config"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
          >
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Quick Presets */}
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Presets
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Apply pre-configured model mappings
                  </p>

                  {/* Free Tier Presets */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-green-100 text-green-700 border-green-200"
                      >
                        Free Tier
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        No premium usage count
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {FREE_PRESETS.map((preset) => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => applyPreset(preset)}
                          title={preset.description}
                        >
                          <Zap className="w-3 h-3 text-green-600" />
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Paid Tier Presets */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"
                      >
                        Pro+ Required
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Uses premium request quota
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PAID_PRESETS.map((preset) => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => applyPreset(preset)}
                          title={preset.description}
                        >
                          <Zap className="w-3 h-3" />
                          {preset.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Model Mapping */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Model Mapping</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Configure which models to use for each tier
                  </p>
                  <div className="space-y-4">
                    <FlexibleModelSelector
                      label="Default Model"
                      description="Used when no specific tier is requested"
                      value={currentModel}
                      onChange={(model) => updateField('model', model)}
                      models={models}
                      disabled={modelsLoading}
                    />
                    <FlexibleModelSelector
                      label="Opus (Most capable)"
                      description="For complex reasoning tasks"
                      value={opusModel || currentModel}
                      onChange={(model) => updateField('opusModel', model)}
                      models={models}
                      disabled={modelsLoading}
                    />
                    <FlexibleModelSelector
                      label="Sonnet (Balanced)"
                      description="Balance of speed and capability"
                      value={sonnetModel || currentModel}
                      onChange={(model) => updateField('sonnetModel', model)}
                      models={models}
                      disabled={modelsLoading}
                    />
                    <FlexibleModelSelector
                      label="Haiku (Fast)"
                      description="Quick responses for simple tasks"
                      value={haikuModel || currentModel}
                      onChange={(model) => updateField('haikuModel', model)}
                      models={models}
                      disabled={modelsLoading}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent
            value="settings"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
          >
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled" className="text-sm font-medium">
                      Enable Copilot
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow using GitHub Copilot subscription
                    </p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={(v) => updateField('enabled', v)}
                  />
                </div>

                {/* Basic Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Basic Settings</h3>

                  {/* Port */}
                  <div className="space-y-2">
                    <Label htmlFor="port" className="text-xs">
                      Port
                    </Label>
                    <Input
                      id="port"
                      type="number"
                      value={port}
                      onChange={(e) => updateField('port', parseInt(e.target.value, 10))}
                      min={1024}
                      max={65535}
                      className="max-w-[150px] h-8"
                    />
                  </div>

                  {/* Account Type */}
                  <div className="space-y-2">
                    <Label htmlFor="account-type" className="text-xs">
                      Account Type
                    </Label>
                    <Select
                      value={accountType}
                      onValueChange={(v) => updateField('accountType', v as typeof accountType)}
                    >
                      <SelectTrigger id="account-type" className="max-w-[150px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Rate Limiting */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Rate Limiting</h3>

                  <div className="space-y-2">
                    <Label htmlFor="rate-limit" className="text-xs">
                      Rate Limit (seconds)
                    </Label>
                    <Input
                      id="rate-limit"
                      type="number"
                      value={rateLimit}
                      onChange={(e) => updateField('rateLimit', e.target.value)}
                      placeholder="No limit"
                      min={0}
                      className="max-w-[150px] h-8"
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="wait-on-limit" className="text-xs">
                        Wait on Rate Limit
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Wait instead of error when limit hit
                      </p>
                    </div>
                    <Switch
                      id="wait-on-limit"
                      checked={waitOnLimit}
                      onCheckedChange={(v) => updateField('waitOnLimit', v)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Daemon Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Daemon Settings</h3>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-start" className="text-xs">
                        Auto-start Daemon
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        Start copilot-api when using profile
                      </p>
                    </div>
                    <Switch
                      id="auto-start"
                      checked={autoStart}
                      onCheckedChange={(v) => updateField('autoStart', v)}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Info Tab */}
          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4" />
                    Configuration Info
                  </h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                      <span className="font-medium text-muted-foreground">Provider</span>
                      <span className="font-mono">GitHub Copilot</span>
                    </div>
                    {rawSettings && (
                      <>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">File Path</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                              {rawSettings.path}
                            </code>
                            <CopyButton value={rawSettings.path} size="icon" className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">Status</span>
                          <Badge
                            variant="outline"
                            className={
                              rawSettings.exists
                                ? 'w-fit text-green-600 border-green-200 bg-green-50'
                                : 'w-fit text-muted-foreground'
                            }
                          >
                            {rawSettings.exists ? 'File exists' : 'Using defaults'}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">Quick Usage</h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    <UsageCommand label="Run with Copilot" command="ccs copilot" />
                    <UsageCommand label="Authenticate" command="ccs copilot auth" />
                    <UsageCommand label="Start daemon" command="ccs copilot --start" />
                    <UsageCommand label="Stop daemon" command="ccs copilot --stop" />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  // Right column: Raw JSON Editor
  const renderRawEditor = () => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading editor...</span>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {!isRawJsonValid && rawJsonEdits !== null && (
          <div className="mb-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 mx-6 mt-4 shrink-0">
            <X className="w-4 h-4" />
            Invalid JSON syntax
          </div>
        )}
        <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
          <div className="h-full border rounded-md overflow-hidden bg-background">
            <CodeEditor
              value={rawJsonContent}
              onChange={handleRawJsonChange}
              language="json"
              minHeight="100%"
            />
          </div>
        </div>
      </div>
    </Suspense>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Copilot Configuration</h2>
              {rawSettings && (
                <Badge variant="outline" className="text-xs">
                  copilot.settings.json
                </Badge>
              )}
            </div>
            {rawSettings && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last modified:{' '}
                {rawSettings.exists ? new Date(rawSettings.mtime).toLocaleString() : 'Never saved'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchRawSettings()}
            disabled={rawSettingsLoading}
          >
            <RefreshCw className={`w-4 h-4 ${rawSettingsLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isUpdating || isSavingRawSettings || !hasChanges || !isRawJsonValid}
          >
            {isUpdating || isSavingRawSettings ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Split Layout - Left panel constrained, Right panel flexible */}
      <div className="flex-1 flex divide-x overflow-hidden">
        {/* Left Column: Friendly UI - constrained width */}
        <div className="w-[540px] shrink-0 flex flex-col overflow-hidden bg-muted/5">
          {renderFriendlyUI()}
        </div>

        {/* Right Column: Raw Editor - takes remaining space */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
            <Code2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Raw Configuration (JSON)
            </span>
          </div>
          {renderRawEditor()}
        </div>
      </div>

      <ConfirmDialog
        open={conflictDialog}
        title="File Modified Externally"
        description="This settings file was modified by another process. Overwrite with your changes or discard?"
        confirmText="Overwrite"
        variant="destructive"
        onConfirm={() => handleConflictResolve(true)}
        onCancel={() => handleConflictResolve(false)}
      />
    </div>
  );
}

/** Usage command with copy button */
function UsageCommand({ label, command }: { label: string; command: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
          {command}
        </code>
        <CopyButton value={command} size="icon" className="h-6 w-6" />
      </div>
    </div>
  );
}
