/**
 * Auth Monitor Component with Account Flow Visualization
 * Shows request flow from accounts to providers using custom SVG bezier curves
 * Uses glass panel aesthetic with hover interactions and glow effects
 */

import { useState, useMemo } from 'react';
import { useCliproxyAuth } from '@/hooks/use-cliproxy';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { getProviderDisplayName, PROVIDER_COLORS } from '@/lib/provider-config';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderIcon } from '@/components/provider-icon';
import { AccountFlowViz } from '@/components/account-flow-viz';
import type { AuthStatus, OAuthAccount } from '@/lib/api-client';
import { Activity, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

interface AccountRow {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  isDefault: boolean;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  color: string;
}

interface ProviderStats {
  provider: string;
  displayName: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  accountCount: number;
  accounts: AccountRow[];
}

function getSuccessRate(success: number, failure: number): number {
  const total = success + failure;
  if (total === 0) return 100;
  return Math.round((success / total) * 100);
}

/** Strip common email domains for cleaner display */
function cleanEmail(email: string): string {
  return email.replace(/@(gmail|yahoo|hotmail|outlook|icloud)\.com$/i, '');
}

// Vibrant colors for account segments
const ACCOUNT_COLORS = [
  '#277da1', // Cerulean
  '#43aa8b', // Seaweed
  '#f9c74f', // Tuscan Sun
  '#f94144', // Strawberry
  '#f3722c', // Pumpkin
  '#90be6d', // Willow
  '#577590', // Blue Slate
  '#f8961e', // Carrot
  '#4d908e', // Dark Cyan
  '#a78bfa', // Purple
];

export function AuthMonitor() {
  const { data, isLoading, error } = useCliproxyAuth();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  // Transform auth status data into account rows
  const { accounts, totalSuccess, totalFailure, totalRequests, providerStats } = useMemo(() => {
    if (!data?.authStatus) {
      return {
        accounts: [],
        totalSuccess: 0,
        totalFailure: 0,
        totalRequests: 0,
        providerStats: [],
      };
    }

    const accountsList: AccountRow[] = [];
    const providerMap = new Map<
      string,
      { success: number; failure: number; accounts: AccountRow[] }
    >();
    let tSuccess = 0;
    let tFailure = 0;
    let colorIndex = 0;

    data.authStatus.forEach((status: AuthStatus) => {
      const providerKey = status.provider;
      if (!providerMap.has(providerKey)) {
        providerMap.set(providerKey, { success: 0, failure: 0, accounts: [] });
      }
      const providerData = providerMap.get(providerKey);
      if (!providerData) return;

      status.accounts?.forEach((account: OAuthAccount) => {
        // Mock stats - in production, fetch from CLIProxy /usage endpoint
        const success = Math.floor(Math.random() * 2000) + 100;
        const failure = account.isDefault ? Math.floor(Math.random() * 50) : 0;
        tSuccess += success;
        tFailure += failure;
        providerData.success += success;
        providerData.failure += failure;

        const row: AccountRow = {
          id: account.id,
          email: account.email || account.id,
          provider: status.provider,
          displayName: status.displayName,
          isDefault: account.isDefault,
          successCount: success,
          failureCount: failure,
          lastUsedAt: account.lastUsedAt,
          color: ACCOUNT_COLORS[colorIndex % ACCOUNT_COLORS.length],
        };
        accountsList.push(row);
        providerData.accounts.push(row);
        colorIndex++;
      });
    });

    // Build provider stats array
    const providerStatsArr: ProviderStats[] = [];
    providerMap.forEach((pData, provider) => {
      if (pData.accounts.length === 0) return;
      providerStatsArr.push({
        provider,
        displayName: getProviderDisplayName(provider),
        totalRequests: pData.success + pData.failure,
        successCount: pData.success,
        failureCount: pData.failure,
        accountCount: pData.accounts.length,
        accounts: pData.accounts,
      });
    });
    providerStatsArr.sort((a, b) => b.totalRequests - a.totalRequests);

    return {
      accounts: accountsList,
      totalSuccess: tSuccess,
      totalFailure: tFailure,
      totalRequests: tSuccess + tFailure,
      providerStats: providerStatsArr,
    };
  }, [data?.authStatus]);

  const overallSuccessRate =
    totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 100;

  // Get selected provider data for detail view
  const selectedProviderData = selectedProvider
    ? providerStats.find((ps) => ps.provider === selectedProvider)
    : null;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 flex-1 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data?.authStatus || accounts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden font-mono text-[13px] text-foreground bg-card/50 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 dark:bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: STATUS_COLORS.success }}
          />
          <span className="text-xs font-medium tracking-tight text-muted-foreground uppercase">
            Live Stream
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{accounts.length} accounts</span>
          <span className="font-mono">{totalRequests.toLocaleString()} req</span>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-border bg-muted/20 dark:bg-zinc-900/30">
        <SummaryCard
          icon={<Activity className="w-4 h-4" />}
          label="Accounts"
          value={accounts.length}
          color="var(--accent)"
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Success"
          value={totalSuccess.toLocaleString()}
          color={STATUS_COLORS.success}
        />
        <SummaryCard
          icon={<XCircle className="w-4 h-4" />}
          label="Failed"
          value={totalFailure.toLocaleString()}
          color={totalFailure > 0 ? STATUS_COLORS.failed : undefined}
        />
        <SummaryCard
          icon={<Activity className="w-4 h-4" />}
          label="Success Rate"
          value={`${overallSuccessRate}%`}
          color={
            overallSuccessRate === 100
              ? STATUS_COLORS.success
              : overallSuccessRate >= 95
                ? STATUS_COLORS.degraded
                : STATUS_COLORS.failed
          }
        />
      </div>

      {/* Flow Visualization */}
      <div className="relative min-h-[320px] overflow-hidden">
        {selectedProviderData ? (
          // Account-level flow view
          <AccountFlowViz
            providerData={selectedProviderData}
            onBack={() => setSelectedProvider(null)}
          />
        ) : (
          // Provider cards view
          <div className="p-6">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
              Request Distribution by Provider
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {providerStats.map((ps) => {
                const successRate = getSuccessRate(ps.successCount, ps.failureCount);
                const providerColor = PROVIDER_COLORS[ps.provider.toLowerCase()] || '#6b7280';
                const isHovered = hoveredProvider === ps.provider;

                return (
                  <button
                    key={ps.provider}
                    onClick={() => setSelectedProvider(ps.provider)}
                    onMouseEnter={() => setHoveredProvider(ps.provider)}
                    onMouseLeave={() => setHoveredProvider(null)}
                    className={cn(
                      'group relative rounded-xl p-4 text-left transition-all duration-300',
                      'bg-muted/30 dark:bg-zinc-900/60 backdrop-blur-sm',
                      'border border-border/50 dark:border-white/[0.08]',
                      'hover:border-opacity-50 hover:scale-[1.02] hover:shadow-lg',
                      isHovered && 'ring-1'
                    )}
                    style={
                      {
                        borderColor: isHovered ? providerColor : undefined,
                        '--ring-color': providerColor,
                      } as React.CSSProperties
                    }
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ProviderIcon provider={ps.provider} size={36} withBackground />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground tracking-tight">
                          {ps.displayName}
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          {ps.accountCount} account{ps.accountCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 ml-auto text-muted-foreground transition-all',
                          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Requests</span>
                        <span className="font-mono text-foreground">
                          {ps.totalRequests.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span
                          className="font-mono font-semibold"
                          style={{
                            color:
                              successRate === 100
                                ? STATUS_COLORS.success
                                : successRate >= 95
                                  ? STATUS_COLORS.degraded
                                  : STATUS_COLORS.failed,
                          }}
                        >
                          {successRate}%
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-muted dark:bg-zinc-800/50 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${successRate}%`,
                            backgroundColor: providerColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Account color dots */}
                    <div className="flex gap-1 mt-3">
                      {ps.accounts.slice(0, 5).map((acc) => (
                        <div
                          key={acc.id}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: acc.color }}
                          title={cleanEmail(acc.email)}
                        />
                      ))}
                      {ps.accounts.length > 5 && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          +{ps.accounts.length - 5}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card/50 dark:bg-zinc-900/50 border border-border/50 dark:border-white/[0.06]">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{
          backgroundColor: color ? `${color}15` : 'var(--muted)',
          color: color || 'var(--muted-foreground)',
        }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div
          className="text-lg font-semibold font-mono leading-tight"
          style={{ color: color || 'var(--foreground)' }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
