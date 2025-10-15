/**
 * Custom Hook: useEmailSearch
 * 
 * Manages search query state, debouncing, and search history.
 * Extracted from the monolithic EmailClient component.
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseEmailSearchReturn {
  searchQuery: string;
  debouncedSearchQuery: string;
  searchHistory: string[];
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  addToHistory: (query: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
}

const SEARCH_HISTORY_KEY = 'emailSearchHistory';
const DEBOUNCE_DELAY = 500; // ms

export function useEmailSearch(): UseEmailSearchReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setSearchHistory(prev => {
      // Add to front, remove duplicates, limit to 10
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
      
      return updated;
    });
  }, []);

  return {
    searchQuery,
    debouncedSearchQuery,
    searchHistory,
    setSearchQuery,
    clearSearch,
    addToHistory,
    showSuggestions,
    setShowSuggestions,
  };
}
