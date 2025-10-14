import React from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AdminDeleteButtonProps {
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
  className?: string;
  variant?: 'outline' | 'destructive';
}

export function AdminDeleteButton({ 
  onDelete, 
  children = 'Delete', 
  className = '', 
  variant = 'destructive' 
}: AdminDeleteButtonProps) {
  const isAdmin = useIsAdmin();

  const handleClick = async () => {
    try {
      await onDelete();
    } catch (error) {
      console.error('Delete operation failed:', error);
      toast.error('Delete operation failed');
    }
  };

  if (!isAdmin) {
    return null; // Hide button completely for non-admins
  }

  return (
    <Button 
      variant={variant}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Button>
  );
}