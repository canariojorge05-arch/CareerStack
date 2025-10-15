import { useState, useCallback } from 'react';

interface ComposeState {
  to: string;
  subject: string;
  body: string;
  attachments: File[];
}

interface UIState {
  composeOpen: boolean;
  accountsOpen: boolean;
  showEmojiPicker: boolean;
  showScheduler: boolean;
  showSearchSuggestions: boolean;
  showKeyboardShortcuts: boolean;
}

export function useEmailState() {
  // Navigation & selection state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'list' | 'split'>('split');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Compose state
  const [composeState, setComposeState] = useState<ComposeState>({
    to: '',
    subject: '',
    body: '',
    attachments: [],
  });

  // UI state
  const [uiState, setUIState] = useState<UIState>({
    composeOpen: false,
    accountsOpen: false,
    showEmojiPicker: false,
    showScheduler: false,
    showSearchSuggestions: false,
    showKeyboardShortcuts: false,
  });

  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  // Helper functions for compose state
  const updateCompose = useCallback((updates: Partial<ComposeState>) => {
    setComposeState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetCompose = useCallback(() => {
    setComposeState({
      to: '',
      subject: '',
      body: '',
      attachments: [],
    });
  }, []);

  // Helper functions for UI state
  const updateUI = useCallback((updates: Partial<UIState>) => {
    setUIState(prev => ({ ...prev, ...updates }));
  }, []);

  const addAttachment = useCallback((files: File[]) => {
    setComposeState(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files],
    }));
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setComposeState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  }, []);

  return {
    // Navigation state
    sidebarOpen,
    setSidebarOpen,
    selectedFolder,
    setSelectedFolder,
    selectedThread,
    setSelectedThread,
    selectedThreads,
    setSelectedThreads,
    view,
    setView,

    // Search state
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    setDebouncedSearchQuery,
    searchHistory,
    setSearchHistory,

    // Compose state
    composeState,
    updateCompose,
    resetCompose,
    addAttachment,
    removeAttachment,

    // UI state
    uiState,
    updateUI,
    scheduledDate,
    setScheduledDate,

    // Backward compatibility
    composeTo: composeState.to,
    composeSubject: composeState.subject,
    composeBody: composeState.body,
    attachments: composeState.attachments,
    setComposeTo: (to: string) => updateCompose({ to }),
    setComposeSubject: (subject: string) => updateCompose({ subject }),
    setComposeBody: (body: string) => updateCompose({ body }),
    setAttachments: (attachments: File[]) => updateCompose({ attachments }),
    composeOpen: uiState.composeOpen,
    accountsOpen: uiState.accountsOpen,
    showEmojiPicker: uiState.showEmojiPicker,
    showScheduler: uiState.showScheduler,
    showSearchSuggestions: uiState.showSearchSuggestions,
    showKeyboardShortcuts: uiState.showKeyboardShortcuts,
    setComposeOpen: (open: boolean) => updateUI({ composeOpen: open }),
    setAccountsOpen: (open: boolean) => updateUI({ accountsOpen: open }),
    setShowEmojiPicker: (show: boolean) => updateUI({ showEmojiPicker: show }),
    setShowScheduler: (show: boolean) => updateUI({ showScheduler: show }),
    setShowSearchSuggestions: (show: boolean) => updateUI({ showSearchSuggestions: show }),
    setShowKeyboardShortcuts: (show: boolean) => updateUI({ showKeyboardShortcuts: show }),
  };
}
