/**
 * Copilot Page - Master-Detail Layout
 * Left sidebar: Status overview + Quick actions
 * Right panel: Split-view configuration form (matches CLIProxy design)
 */

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Github,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Power,
  PowerOff,
  Key,
  Server,
  Cpu,
  Download,
  Loader2,
} from 'lucide-react';
import { useCopilot } from '@/hooks/use-copilot';
import { CopilotConfigForm } from '@/components/copilot/copilot-config-form';
import { cn } from '@/lib/utils';

// Status section component
function StatusSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// Status item component
function StatusItem({
  icon: Icon,
  label,
  status,
  statusText,
  variant = 'default',
}: {
  icon: React.ElementType;
  label: string;
  status: boolean;
  statusText?: string;
  variant?: 'default' | 'warning';
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {status ? (
          <>
            <CheckCircle2
              className={cn(
                'w-4 h-4',
                variant === 'warning' ? 'text-yellow-500' : 'text-green-500'
              )}
            />
            <span
              className={cn(
                'text-xs',
                variant === 'warning' ? 'text-yellow-500' : 'text-green-500'
              )}
            >
              {statusText || 'Yes'}
            </span>
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{statusText || 'No'}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Empty state when loading
function LoadingSidebar() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function CopilotPage() {
  const {
    status,
    statusLoading,
    refetchStatus,
    startAuth,
    isAuthenticating,
    startDaemon,
    isStartingDaemon,
    stopDaemon,
    isStoppingDaemon,
    install,
    isInstalling,
  } = useCopilot();

  return (
    <div className="h-[calc(100vh-100px)] flex">
      {/* Left Sidebar - Status Overview */}
      <div className="w-80 border-r flex flex-col bg-muted/30 shrink-0">
        {/* Header */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Github className="w-5 h-5 text-primary" />
              <h1 className="font-semibold">Copilot</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetchStatus()}
              disabled={statusLoading}
            >
              <RefreshCw className={cn('w-4 h-4', statusLoading && 'animate-spin')} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">GitHub Copilot proxy</p>
        </div>

        {/* Status Overview */}
        <ScrollArea className="flex-1">
          {statusLoading ? (
            <LoadingSidebar />
          ) : (
            <div className="p-3 space-y-4">
              {/* Warning Banner - Disclaimer */}
              <div className="rounded-md border border-yellow-500/50 bg-yellow-500/15 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                    Unofficial API - Use at Your Own Risk
                  </span>
                </div>
                <ul className="text-[11px] text-yellow-700 dark:text-yellow-300 space-y-0.5 pl-6 list-disc">
                  <li>Reverse-engineered API - may break anytime</li>
                  <li>Excessive use may trigger account restrictions</li>
                  <li>No warranty, no responsibility from CCS</li>
                </ul>
              </div>

              {/* Setup - Binary first, then enabled status */}
              <StatusSection title="Setup">
                <StatusItem
                  icon={Server}
                  label="copilot-api"
                  status={status?.installed ?? false}
                  statusText={
                    status?.installed
                      ? status.version
                        ? `v${status.version}`
                        : 'Installed'
                      : 'Missing'
                  }
                />
                {!status?.installed && (
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => install(undefined)}
                    disabled={isInstalling}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Install copilot-api
                      </>
                    )}
                  </Button>
                )}
                {status?.installed && (
                  <StatusItem
                    icon={Power}
                    label="Integration"
                    status={status?.enabled ?? false}
                    statusText={status?.enabled ? 'Enabled' : 'Disabled'}
                  />
                )}
              </StatusSection>

              {/* Authentication - only show after binary installed */}
              {status?.installed && (
                <StatusSection title="Auth">
                  <StatusItem
                    icon={Key}
                    label="GitHub"
                    status={status?.authenticated ?? false}
                    statusText={status?.authenticated ? 'Connected' : 'Not Connected'}
                  />
                  {!status?.authenticated && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => startAuth()}
                      disabled={isAuthenticating}
                    >
                      {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                    </Button>
                  )}
                </StatusSection>
              )}

              {/* Daemon - only show after authenticated */}
              {status?.authenticated && (
                <StatusSection title="Daemon">
                  <StatusItem
                    icon={Cpu}
                    label="Status"
                    status={status?.daemon_running ?? false}
                    statusText={status?.daemon_running ? 'Running' : 'Stopped'}
                  />
                  <div className="px-3 py-1 text-xs text-muted-foreground">
                    Port: {status?.port ?? 4141}
                  </div>
                  <div className="px-1">
                    {status?.daemon_running ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => stopDaemon()}
                        disabled={isStoppingDaemon}
                      >
                        <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                        {isStoppingDaemon ? 'Stopping...' : 'Stop'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => startDaemon()}
                        disabled={isStartingDaemon}
                      >
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        {isStartingDaemon ? 'Starting...' : 'Start'}
                      </Button>
                    )}
                  </div>
                </StatusSection>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t bg-background text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Proxy</span>
            {status?.daemon_running ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-muted-foreground" />
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Split-view Configuration Form */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <CopilotConfigForm />
      </div>
    </div>
  );
}
