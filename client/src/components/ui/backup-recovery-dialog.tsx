import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { FormBackup } from '@/hooks/useFormBackup';
import { History, RotateCcw, Trash2 } from 'lucide-react';

interface BackupRecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  backups: FormBackup<any>[];
  onRecover: (timestamp: string) => void;
  onClearAll: () => void;
}

export function BackupRecoveryDialog({
  open,
  onClose,
  backups,
  onRecover,
  onClearAll,
}: BackupRecoveryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <History className="w-5 h-5" />
            <span>Form Backups</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-1">
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No backups available
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => (
                <div
                  key={backup.timestamp}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div>
                    <div className="font-medium">
                      {formatDistanceToNow(new Date(backup.timestamp), { addSuffix: true })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(backup.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRecover(backup.timestamp)}
                    className="flex items-center space-x-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Recover</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="destructive"
            size="sm"
            onClick={onClearAll}
            className="flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Backups</span>
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}