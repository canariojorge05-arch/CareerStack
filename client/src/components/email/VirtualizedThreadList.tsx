/**
 * VirtualizedThreadList Component
 * 
 * Extracted from the monolithic EmailClient.
 * Handles virtualized rendering of email threads for better performance.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Star, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmailThread } from '@/types/email';

interface VirtualizedThreadListProps {
  threads: EmailThread[];
  selectedThread: string | null;
  selectedThreads: Set<string>;
  onThreadSelect: (threadId: string) => void;
  onThreadCheckToggle: (threadId: string, checked: boolean) => void;
  starMutation: any;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export const VirtualizedThreadList = React.memo<VirtualizedThreadListProps>(({
  threads,
  selectedThread,
  selectedThreads,
  onThreadSelect,
  onThreadCheckToggle,
  starMutation,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling configuration - OPTIMIZED
  const rowVirtualizer = useVirtualizer({
    count: threads.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10, // Increased from 5 to 10 for smoother scrolling
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? element => element?.getBoundingClientRect().height
      : undefined,
    // Enable smooth scrolling calculations
    scrollMargin: 0,
    gap: 0,
  });

  // Infinite scroll: load more when near bottom
  const virtualItems = rowVirtualizer.getVirtualItems();
  
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= threads.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    threads.length,
    isFetchingNextPage,
    virtualItems.length,
  ]);

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > threads.length - 1;
          const thread = threads[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? (
                  <div className="flex items-center justify-center py-4 border-t border-gray-100">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600">Loading more...</span>
                  </div>
                ) : null
              ) : (
                <ThreadRow
                  thread={thread}
                  isSelected={selectedThread === thread.id}
                  isChecked={selectedThreads.has(thread.id)}
                  onSelect={onThreadSelect}
                  onCheckToggle={onThreadCheckToggle}
                  starMutation={starMutation}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualizedThreadList.displayName = 'VirtualizedThreadList';

// Thread Row Component (Memoized for performance)
const ThreadRow = React.memo<{
  thread: EmailThread;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (threadId: string) => void;
  onCheckToggle: (threadId: string, checked: boolean) => void;
  starMutation: any;
}>(({
  thread,
  isSelected,
  isChecked,
  onSelect,
  onCheckToggle,
  starMutation,
}) => {
  const handleSelect = useCallback(() => {
    onSelect(thread.id);
  }, [onSelect, thread.id]);

  const handleCheckChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onCheckToggle(thread.id, e.target.checked);
  }, [onCheckToggle, thread.id]);

  const handleStarToggle = useCallback(() => {
    const message = thread.messages?.[0];
    if (message) {
      starMutation.mutate({ messageId: message.id, isStarred: !message.isStarred });
    }
  }, [starMutation, thread.messages]);

  const isUnread = thread.messages?.[0]?.isRead === false;
  const isStarred = thread.messages?.[0]?.isStarred;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-all group relative border-b border-gray-100",
        isSelected
          ? "bg-blue-50 shadow-sm"
          : isUnread
          ? "bg-white hover:shadow-sm"
          : "bg-gray-50 hover:bg-gray-100",
        isSelected && "border-l-4 border-blue-600"
      )}
      onClick={handleSelect}
    >
      <input
        type="checkbox"
        className="accent-blue-600 rounded cursor-pointer"
        checked={isChecked}
        onChange={handleCheckChange}
      />

      <button
        className={cn(
          "transition-all focus:outline-none",
          isStarred ? "text-yellow-500" : "text-gray-300 group-hover:text-gray-400"
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleStarToggle();
        }}
      >
        <Star className={cn("h-4 w-4", isStarred && "fill-yellow-500")} />
      </button>

      {isUnread && <div className="h-2 w-2 rounded-full bg-blue-600" />}

      <div className="flex-1 min-w-0 grid grid-cols-[200px,1fr,auto] gap-3 items-center">
        <span
          className={cn(
            "truncate text-sm",
            isUnread ? "font-bold text-gray-900" : "font-normal text-gray-800"
          )}
        >
          {thread.participantEmails[0]?.split('@')[0] || 'Unknown'}
        </span>

        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "truncate text-sm max-w-xs",
              isUnread ? "font-bold text-gray-900" : "font-normal text-gray-700"
            )}
          >
            {thread.subject || '(no subject)'}
          </span>
          <span className="text-sm text-gray-500 truncate">
            — {thread.preview || 'No preview'}
          </span>
        </div>

        <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          {thread.lastMessageAt &&
            (new Date(thread.lastMessageAt).toDateString() ===
            new Date().toDateString()
              ? format(new Date(thread.lastMessageAt), 'h:mm a')
              : format(new Date(thread.lastMessageAt), 'MMM d'))}
        </span>
      </div>

      {thread.labels && thread.labels.length > 0 && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {thread.labels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});

ThreadRow.displayName = 'ThreadRow';
