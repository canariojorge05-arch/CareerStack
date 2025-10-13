import { KeyboardEvent } from 'react';

export type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const matchedShortcut = shortcuts.find(
      (shortcut) =>
        shortcut.key.toLowerCase() === e.key.toLowerCase() &&
        !!shortcut.ctrlKey === e.ctrlKey &&
        !!shortcut.altKey === e.altKey &&
        !!shortcut.shiftKey === e.shiftKey
    );

    if (matchedShortcut) {
      e.preventDefault();
      matchedShortcut.action();
    }
  };

  return handleKeyDown;
}

// Pre-configured keyboard shortcuts for form navigation
export const getFormNavigationShortcuts = (setActiveTab: (tab: string) => void) => [
  { key: '1', ctrlKey: true, action: () => setActiveTab('requirement') },
  { key: '2', ctrlKey: true, action: () => setActiveTab('client') },
  { key: '3', ctrlKey: true, action: () => setActiveTab('vendor') },
  { key: '4', ctrlKey: true, action: () => setActiveTab('job') },
];