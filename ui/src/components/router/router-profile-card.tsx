/**
 * Router Profile Card - Display profile summary in list
 * Shows truncated name with tier status indicators
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Layers, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RouterProfileSummary } from '@/lib/router-types';

interface RouterProfileCardProps {
  profile: RouterProfileSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

// Check if profile has unconfigured tiers (draft state)
function hasEmptyTiers(_profile: RouterProfileSummary): boolean {
  // Tiers array contains tier names, but we can't know if they're configured from summary
  // This will be enhanced when we have tier status in summary
  return false;
}

export function RouterProfileCard({
  profile,
  isActive,
  onClick,
  onDelete,
}: RouterProfileCardProps) {
  const isDraft = hasEmptyTiers(profile);
  // Truncate long profile names for display
  const displayName = profile.name.length > 20 ? `${profile.name.slice(0, 17)}...` : profile.name;

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 group ${
        isActive ? 'border-primary bg-muted/30' : ''
      } ${isDraft ? 'border-dashed border-yellow-500/50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-sm truncate">{displayName}</span>
              </TooltipTrigger>
              {profile.name.length > 20 && (
                <TooltipContent side="top">
                  <p className="font-mono text-xs">{profile.name}</p>
                </TooltipContent>
              )}
            </Tooltip>
            {isDraft && <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
        {/* Compact tier badges - single letter */}
        <div className="flex items-center gap-1 mt-2">
          {profile.tiers.map((tier) => (
            <Badge
              key={tier}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono uppercase"
            >
              {tier.charAt(0)}
            </Badge>
          ))}
          {profile.description && (
            <span className="text-xs text-muted-foreground truncate ml-2">
              {profile.description}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
