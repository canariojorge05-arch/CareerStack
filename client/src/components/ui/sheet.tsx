import * as React from 'react';

export interface SheetProps extends React.ComponentProps<'div'> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
export const Sheet: React.FC<SheetProps> = ({ children, open: _open, onOpenChange: _onOpenChange, ...props }) => (
  <div {...props}>{children}</div>
);

export interface SheetContentProps extends React.ComponentProps<'div'> {
  side?: 'left' | 'right' | 'top' | 'bottom';
}
export const SheetContent: React.FC<SheetContentProps> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const SheetHeader: React.FC<React.ComponentProps<'div'>> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);

export const SheetTitle: React.FC<React.ComponentProps<'h2'>> = ({ children, ...props }) => (
  <h2 {...props}>{children}</h2>
);

export const SheetDescription: React.FC<React.ComponentProps<'p'>> = ({ children, ...props }) => (
  <p {...props}>{children}</p>
);
