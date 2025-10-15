/**
 * KeyboardShortcutsDialog Component
 * 
 * Lazy-loaded keyboard shortcuts help dialog.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KeyboardShortcut {
  key: string;
  description: string;
}

const shortcuts: KeyboardShortcut[] = [
  { key: 'C', description: 'Compose new email' },
  { key: '/', description: 'Focus search' },
  { key: 'R', description: 'Reply to selected email' },
  { key: 'E', description: 'Archive selected email' },
  { key: 'Esc', description: 'Close compose or go back' },
  { key: 'Ctrl+Enter', description: 'Send email' },
  { key: '?', description: 'Show keyboard shortcuts' },
];

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
