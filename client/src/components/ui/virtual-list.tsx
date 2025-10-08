import React, { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  rowHeight?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualList<T>({
  items,
  height,
  rowHeight = 50,
  renderItem,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: 5,
  });

  // Handle scroll end for infinite loading
  const handleScroll = useCallback(() => {
    if (!onEndReached) return;

    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const scrollProgress =
      scrollElement.scrollTop / (scrollElement.scrollHeight - scrollElement.clientHeight);

    if (scrollProgress > endReachedThreshold) {
      onEndReached();
    }
  }, [onEndReached, endReachedThreshold]);

  return (
    <div
      ref={parentRef}
      style={{
        height,
        overflow: 'auto',
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${virtualRow.start}px)`,
              width: '100%',
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
