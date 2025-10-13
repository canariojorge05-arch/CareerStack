import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download,
  Trash2,
  Edit,
  Archive,
  Send,
  Copy,
  Tag,
  X,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  variant?: 'default' | 'destructive' | 'outline';
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  disabled?: (selectedItems: any[]) => boolean;
  disabledReason?: string;
}

interface BulkActionsProps {
  selectedItems: any[];
  totalCount: number;
  actions: BulkAction[];
  onAction: (actionId: string, selectedItems: any[]) => Promise<void>;
  onClearSelection: () => void;
  className?: string;
}

export function BulkActions({
  selectedItems,
  totalCount,
  actions,
  onAction,
  onClearSelection,
  className,
}: BulkActionsProps) {
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  if (selectedItems.length === 0) {
    return null;
  }

  const handleActionClick = (action: BulkAction) => {
    if (action.disabled?.(selectedItems)) {
      toast.error(action.disabledReason || 'This action is not available for the selected items');
      return;
    }

    if (action.requiresConfirmation) {
      setPendingAction(action);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction) => {
    setIsExecuting(true);
    try {
      await onAction(action.id, selectedItems);
      toast.success(`Successfully executed ${action.label} on ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`);
      onClearSelection();
    } catch (error) {
      toast.error(`Failed to execute ${action.label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  const confirmAction = () => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  };

  return (
    <>
      <Card className={`border-blue-200 bg-blue-50/50 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedItems.length} of {totalCount} selected
              </Badge>
              
              <div className="flex items-center space-x-2">
                {actions.map((action) => {
                  const IconComponent = action.icon;
                  const isDisabled = action.disabled?.(selectedItems) || isExecuting;
                  
                  return (
                    <Button
                      key={action.id}
                      size="sm"
                      variant={action.variant || 'outline'}
                      onClick={() => handleActionClick(action)}
                      disabled={isDisabled}
                      className="flex items-center space-x-2"
                      title={isDisabled ? action.disabledReason : action.label}
                    >
                      <IconComponent size={16} />
                      <span>{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-slate-600 hover:text-slate-900"
            >
              <X size={16} className="mr-1" />
              Clear Selection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle size={20} className="text-orange-600" />
              <span>{pendingAction?.confirmationTitle || 'Confirm Action'}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirmationDescription || 
                `Are you sure you want to ${pendingAction?.label.toLowerCase()} ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={pendingAction?.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isExecuting ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Predefined bulk actions for different entity types
export const createBulkActions = {
  requirements: (): BulkAction[] => [
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      variant: 'outline',
    },
    {
      id: 'update-status',
      label: 'Update Status',
      icon: Edit,
      variant: 'outline',
    },
    {
      id: 'assign-consultant',
      label: 'Assign Consultant',
      icon: Tag,
      variant: 'outline',
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      variant: 'outline',
      requiresConfirmation: true,
      confirmationTitle: 'Archive Requirements',
      confirmationDescription: 'Archived requirements will be moved out of the active list but can be restored later.',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationTitle: 'Delete Requirements',
      confirmationDescription: 'This will permanently delete the selected requirements and all associated data.',
    },
  ],

  consultants: (): BulkAction[] => [
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      variant: 'outline',
    },
    {
      id: 'update-status',
      label: 'Update Status',
      icon: Edit,
      variant: 'outline',
    },
    {
      id: 'send-email',
      label: 'Send Email',
      icon: Send,
      variant: 'outline',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      variant: 'outline',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
      disabled: (items) => items.some(item => item.requirements?.length > 0 || item.interviews?.length > 0),
      disabledReason: 'Cannot delete consultants with associated requirements or interviews',
    },
  ],

  interviews: (): BulkAction[] => [
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      variant: 'outline',
    },
    {
      id: 'reschedule',
      label: 'Reschedule',
      icon: Edit,
      variant: 'outline',
    },
    {
      id: 'send-reminder',
      label: 'Send Reminder',
      icon: Send,
      variant: 'outline',
      disabled: (items) => items.some(item => item.status === 'Cancelled' || item.status === 'Completed'),
      disabledReason: 'Cannot send reminders for cancelled or completed interviews',
    },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: X,
      variant: 'destructive',
      requiresConfirmation: true,
      disabled: (items) => items.some(item => item.status === 'Cancelled' || item.status === 'Completed'),
      disabledReason: 'Cannot cancel already cancelled or completed interviews',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
    },
  ],
};

// Hook for managing bulk operations
export function useBulkOperations<T>(
  data: T[],
  getItemId: (item: T) => string = (item: any) => item.id
) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const selectedData = data.filter(item => selectedItems.includes(getItemId(item)));

  const selectAll = () => {
    setSelectedItems(data.map(getItemId));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isSelected = (itemId: string) => selectedItems.includes(itemId);

  const isAllSelected = data.length > 0 && selectedItems.length === data.length;
  const isIndeterminate = selectedItems.length > 0 && selectedItems.length < data.length;

  return {
    selectedItems,
    selectedData,
    setSelectedItems,
    selectAll,
    clearSelection,
    toggleItem,
    isSelected,
    isAllSelected,
    isIndeterminate,
    selectedCount: selectedItems.length,
    totalCount: data.length,
  };
}
