import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNavigation({ items, className = '' }: BreadcrumbNavigationProps) {
  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`} aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-slate-500 hover:text-slate-700"
        onClick={() => window.location.href = '/dashboard'}
      >
        <Home size={14} />
      </Button>
      
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="text-slate-400" />
          {item.onClick || item.href ? (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2 ${
                item.isActive 
                  ? 'text-slate-900 font-medium' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={item.onClick}
            >
              {item.label}
            </Button>
          ) : (
            <span className={`${
              item.isActive 
                ? 'text-slate-900 font-medium' 
                : 'text-slate-600'
            }`}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
