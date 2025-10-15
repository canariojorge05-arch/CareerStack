/**
 * AccountsDialog Component
 * 
 * Lazy-loaded accounts management dialog.
 * TODO: Implement full account management features.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AccountsDialog() {
  return (
    <Dialog open={false}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email Accounts</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">Account management coming soon...</p>
      </DialogContent>
    </Dialog>
  );
}
