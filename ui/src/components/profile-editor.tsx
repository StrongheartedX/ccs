/**
 * Profile Editor Component
 * Inline editor for API profile settings with 2-column layout (Friendly UI + Raw JSON)
 */

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/ui/masked-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Save, Loader2, Code2, Trash2, RefreshCw, Plus, X, Info } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/ui/copy-button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Lazy load CodeEditor to reduce initial bundle size
const CodeEditor = lazy(() =>
  import('@/components/code-editor').then((m) => ({ default: m.CodeEditor }))
);

interface Settings {
  env?: Record<string, string>;
}

interface SettingsResponse {
  profile: string;
  settings: Settings;
  mtime: number;
  path: string;
}

interface ProfileEditorProps {
  profileName: string;
  onDelete?: () => void;
}

export function ProfileEditor({ profileName, onDelete }: ProfileEditorProps) {
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [conflictDialog, setConflictDialog] = useState(false);
  const [rawJsonEdits, setRawJsonEdits] = useState<string | null>(null);
  const [newEnvKey, setNewEnvKey] = useState('');
  const queryClient = useQueryClient();

  // Fetch settings for selected profile
  const { data, isLoading, isError, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', profileName],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${profileName}/raw`);
      if (!res.ok) {
        throw new Error(`Failed to load settings: ${res.status}`);
      }
      return res.json();
    },
  });

  // Derive raw JSON content
  const settings = data?.settings;
  const rawJsonContent = useMemo(() => {
    if (rawJsonEdits !== null) {
      return rawJsonEdits;
    }
    if (settings) {
      return JSON.stringify(settings, null, 2);
    }
    return '';
  }, [rawJsonEdits, settings]);

  const handleRawJsonChange = useCallback((value: string) => {
    setRawJsonEdits(value);
  }, []);

  // Derive current settings by merging original data with local edits
  // Prioritize rawJsonEdits if available
  const currentSettings = useMemo((): Settings | undefined => {
    if (rawJsonEdits !== null) {
      try {
        return JSON.parse(rawJsonEdits);
      } catch {
        // If invalid JSON, fall back to undefined or partial state
        // The UI will likely show empty or potentially broken state if JSON is invalid,
        // but the Raw Editor will show the error.
      }
    }

    if (!settings) return undefined;
    return {
      ...settings,
      env: {
        ...settings.env,
        ...localEdits,
      },
    };
  }, [settings, localEdits, rawJsonEdits]);

  // Sync Visual Editor changes to Raw JSON
  const updateEnvValue = (key: string, value: string) => {
    const newEnv = { ...(currentSettings?.env || {}), [key]: value };

    // Update local edits
    setLocalEdits((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Update rawJsonEdits to keep sync
    const newSettings = { ...currentSettings, env: newEnv };
    setRawJsonEdits(JSON.stringify(newSettings, null, 2));
  };

  const addNewEnvVar = () => {
    if (!newEnvKey.trim()) return;
    const key = newEnvKey.trim();
    const newEnv = { ...(currentSettings?.env || {}), [key]: '' };

    setLocalEdits((prev) => ({
      ...prev,
      [key]: '',
    }));

    const newSettings = { ...currentSettings, env: newEnv };
    setRawJsonEdits(JSON.stringify(newSettings, null, 2));

    setNewEnvKey('');
  };

  // Check if raw JSON is valid
  const isRawJsonValid = useMemo(() => {
    try {
      JSON.parse(rawJsonContent);
      return true;
    } catch {
      return false;
    }
  }, [rawJsonContent]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (rawJsonEdits !== null) {
      return rawJsonEdits !== JSON.stringify(settings, null, 2);
    }
    return Object.keys(localEdits).length > 0;
  }, [rawJsonEdits, localEdits, settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let settingsToSave: Settings;

      try {
        // Always save from rawJsonContent as it's the source of truth
        settingsToSave = JSON.parse(rawJsonContent);
      } catch {
        // Fallback (should typically not happen if validation is correct)
        settingsToSave = {
          ...data?.settings,
          env: {
            ...data?.settings?.env,
            ...localEdits,
          },
        };
      }

      const res = await fetch(`/api/settings/${profileName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToSave,
          expectedMtime: data?.mtime,
        }),
      });

      if (res.status === 409) {
        throw new Error('CONFLICT');
      }

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', profileName] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setLocalEdits({});
      setRawJsonEdits(null);
      toast.success('Settings saved');
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        setConflictDialog(true);
      } else {
        toast.error(error.message);
      }
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false);
    if (overwrite) {
      await refetch();
      saveMutation.mutate();
    } else {
      setLocalEdits({});
      setRawJsonEdits(null);
    }
  };

  const isSensitiveKey = (key: string): boolean => {
    const sensitivePatterns = [
      /^ANTHROPIC_AUTH_TOKEN$/,
      /_API_KEY$/,
      /_AUTH_TOKEN$/,
      /^API_KEY$/,
      /^AUTH_TOKEN$/,
      /_SECRET$/,
      /^SECRET$/,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(key));
  };

  // Reset state when profile changes
  const profileKey = profileName;

  // Render Left Column Content (Environment + Info + Usage)
  const renderFriendlyUI = () => (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="env" className="h-full flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="env" className="flex-1">
              Environment Variables
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info & Usage
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <TabsContent
            value="env"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden"
          >
            {/* Scrollable Environment Variables List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {currentSettings?.env && Object.keys(currentSettings.env).length > 0 ? (
                  <>
                    {Object.entries(currentSettings.env).map(([key, value]) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs font-medium flex items-center gap-2 text-muted-foreground">
                          {key}
                          {isSensitiveKey(key) && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              sensitive
                            </Badge>
                          )}
                        </Label>
                        {isSensitiveKey(key) ? (
                          <MaskedInput
                            value={value}
                            onChange={(e) => updateEnvValue(key, e.target.value)}
                            className="font-mono text-sm h-8"
                          />
                        ) : (
                          <Input
                            value={value}
                            onChange={(e) => updateEnvValue(key, e.target.value)}
                            className="font-mono text-sm h-8"
                          />
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed text-sm">
                    <p>No environment variables configured.</p>
                    <p className="text-xs mt-1 opacity-70">
                      Add variables using the input below or edit the JSON directly.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Fixed Add Input at Bottom */}
            <div className="p-4 border-t bg-background shrink-0">
              <Label className="text-xs font-medium text-muted-foreground">
                Add Environment Variable
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="VARIABLE_NAME"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  className="font-mono text-sm h-8"
                  onKeyDown={(e) => e.key === 'Enter' && addNewEnvVar()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={addNewEnvVar}
                  disabled={!newEnvKey.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Profile Information */}
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4" />
                    Profile Information
                  </h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    {data && (
                      <>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">Profile Name</span>
                          <span className="font-mono">{data.profile}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">File Path</span>
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                              {data.path}
                            </code>
                            <CopyButton value={data.path} size="icon" className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                          <span className="font-medium text-muted-foreground">Last Modified</span>
                          <span className="text-xs">{new Date(data.mtime).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Usage */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Quick Usage</h3>
                  <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Run with profile</Label>
                      <div className="mt-1 flex gap-2">
                        <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                          ccs {profileName} "prompt"
                        </code>
                        <CopyButton
                          value={`ccs ${profileName} "prompt"`}
                          size="icon"
                          className="h-6 w-6"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Set as default</Label>
                      <div className="mt-1 flex gap-2">
                        <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                          ccs default {profileName}
                        </code>
                        <CopyButton
                          value={`ccs default ${profileName}`}
                          size="icon"
                          className="h-6 w-6"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  // Render Right Column Content (Raw JSON Editor)
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
    <div key={profileKey} className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{profileName}</h2>
            {data?.path && (
              <Badge variant="outline" className="text-xs">
                {data.path.replace(/^.*\//, '')}
              </Badge>
            )}
          </div>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last modified: {new Date(data.mtime).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges || !isRawJsonValid}
          >
            {saveMutation.isPending ? (
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

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading settings...</span>
        </div>
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Failed to load settings for this profile.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      ) : (
        // Split Layout (40% Left / 60% Right)
        <div className="flex-1 grid grid-cols-[40%_60%] divide-x overflow-hidden">
          {/* Left Column: Friendly UI */}
          <div className="flex flex-col overflow-hidden bg-muted/5">{renderFriendlyUI()}</div>

          {/* Right Column: Raw Editor */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2 shrink-0 h-[45px]">
              <Code2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Raw Configuration (JSON)
              </span>
            </div>
            {renderRawEditor()}
          </div>
        </div>
      )}

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
