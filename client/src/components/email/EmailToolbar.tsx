/**
 * EmailToolbar Component
 * 
 * Handles the toolbar above the email list with:
 * - Select all checkbox
 * - Bulk actions (archive, delete, mark as read)
 * - Refresh button
 * - Thread count display
 * 
 * Extracted from the monolithic EmailClient to improve performance and maintainability.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Square, SquareCheck, Archive, Trash2, MailOpen, X, RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailToolbarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  isRefreshing: boolean;
  isFetchingMore: boolean;
  onSelectAllToggle: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onMarkAsRead: () => void;
  onClearSelection: () => void;
  onRefresh: () => void;
  displayedCount: number;
}

export const EmailToolbar = React.memo(({
  selectedCount,
  totalCount,
  allSelected,
  isRefreshing,
  isFetchingMore,
  onSelectAllToggle,
  onBulkArchive,
  onBulkDelete,
  onMarkAsRead,
  onClearSelection,
  onRefresh,
  displayedCount,
}: EmailToolbarProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onSelectAllToggle}
            >
              {allSelected ? (
                <SquareCheck className="h-4 w-4 text-blue-600" />
              ) : selectedCount > 0 ? (
                <SquareCheck className="h-4 w-4 text-blue-400" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select all (*+a)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {selectedCount > 0 ? (
          <>
            <Badge variant="secondary" className="ml-2">
              {selectedCount} selected
            </Badge>
            
            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-green-50"
                  onClick={onBulkArchive}
                >
                  <Archive className="h-4 w-4 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive selected</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-red-50"
                  onClick={onBulkDelete}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete selected</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  onClick={onMarkAsRead}
                >
                  <MailOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as read</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  onClick={onClearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear selection</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">
          {displayedCount > 0 ? '1' : '0'}-{displayedCount} of {totalCount}
        </span>
        {isFetchingMore && (
          <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
        )}
      </div>
    </div>
  );
});

EmailToolbar.displayName = 'EmailToolbar';
