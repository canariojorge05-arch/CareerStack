/**
 * Custom Hook: useEmailModals
 * 
 * Manages all modal/dialog states in the email client.
 * Consolidates multiple boolean states into a single hook.
 */

import { useState, useCallback } from 'react';

export interface ModalStates {
  accounts: boolean;
  emojiPicker: boolean;
  scheduler: boolean;
  keyboardShortcuts: boolean;
}

export interface UseEmailModalsReturn extends ModalStates {
  openAccounts: () => void;
  closeAccounts: () => void;
  toggleEmojiPicker: () => void;
  closeEmojiPicker: () => void;
  openScheduler: () => void;
  closeScheduler: () => void;
  openKeyboardShortcuts: () => void;
  closeKeyboardShortcuts: () => void;
  closeAll: () => void;
}

export function useEmailModals(): UseEmailModalsReturn {
  const [modals, setModals] = useState<ModalStates>({
    accounts: false,
    emojiPicker: false,
    scheduler: false,
    keyboardShortcuts: false,
  });

  const openAccounts = useCallback(() => {
    setModals(prev => ({ ...prev, accounts: true }));
  }, []);

  const closeAccounts = useCallback(() => {
    setModals(prev => ({ ...prev, accounts: false }));
  }, []);

  const toggleEmojiPicker = useCallback(() => {
    setModals(prev => ({ ...prev, emojiPicker: !prev.emojiPicker }));
  }, []);

  const closeEmojiPicker = useCallback(() => {
    setModals(prev => ({ ...prev, emojiPicker: false }));
  }, []);

  const openScheduler = useCallback(() => {
    setModals(prev => ({ ...prev, scheduler: true }));
  }, []);

  const closeScheduler = useCallback(() => {
    setModals(prev => ({ ...prev, scheduler: false }));
  }, []);

  const openKeyboardShortcuts = useCallback(() => {
    setModals(prev => ({ ...prev, keyboardShortcuts: true }));
  }, []);

  const closeKeyboardShortcuts = useCallback(() => {
    setModals(prev => ({ ...prev, keyboardShortcuts: false }));
  }, []);

  const closeAll = useCallback(() => {
    setModals({
      accounts: false,
      emojiPicker: false,
      scheduler: false,
      keyboardShortcuts: false,
    });
  }, []);

  return {
    ...modals,
    openAccounts,
    closeAccounts,
    toggleEmojiPicker,
    closeEmojiPicker,
    openScheduler,
    closeScheduler,
    openKeyboardShortcuts,
    closeKeyboardShortcuts,
    closeAll,
  };
}
