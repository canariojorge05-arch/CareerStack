/**
 * Custom Hook: useEmailSelection
 * 
 * Manages email thread selection state and actions.
 * Extracted from the monolithic EmailClient component to reduce complexity.
 */

import { useState, useCallback } from 'react';

export interface UseEmailSelectionReturn {
  selectedThread: string | null;
  setSelectedThread: (threadId: string | null) => void;
  selectedThreads: Set<string>;
  toggleThread: (threadId: string, checked: boolean) => void;
  selectAll: (threadIds: string[]) => void;
  clearSelection: () => void;
  isThreadSelected: (threadId: string) => boolean;
}

export function useEmailSelection(): UseEmailSelectionReturn {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());

  const toggleThread = useCallback((threadId: string, checked: boolean) => {
    setSelectedThreads(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(threadId);
      } else {
        newSet.delete(threadId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((threadIds: string[]) => {
    setSelectedThreads(new Set(threadIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedThreads(new Set());
  }, []);

  const isThreadSelected = useCallback((threadId: string) => {
    return selectedThreads.has(threadId);
  }, [selectedThreads]);

  return {
    selectedThread,
    setSelectedThread,
    selectedThreads,
    toggleThread,
    selectAll,
    clearSelection,
    isThreadSelected,
  };
}
