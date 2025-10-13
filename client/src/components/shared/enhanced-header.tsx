import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, Filter, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuickStat {
  label: string;
  value: number | string;
  variant?: 'default' | 'secondary' | 'outline';
}

interface QuickAction {
  label: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary';
}

interface EnhancedHeaderProps {
  title: string;
  description?: string;
  stats?: QuickStat[];
  actions?: QuickAction[];
  children?: React.ReactNode;
}

export function EnhancedHeader({ 
  title, 
  description, 
  stats = [], 
  actions = [], 
  children 
}: EnhancedHeaderProps) {
  const primaryActions = actions.slice(0, 2);
  const secondaryActions = actions.slice(2);

  return (
    <div className="flex flex-col space-y-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          {description && (
            <p className="text-slate-600 max-w-2xl">{description}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Quick Stats */}
          {stats.map((stat, index) => (
            <Badge 
              key={index}
              variant={stat.variant || 'outline'} 
              className="px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{stat.value}</span>
              <span className="ml-1 text-xs opacity-75">{stat.label}</span>
            </Badge>
          ))}
          
          {/* Primary Actions */}
          {primaryActions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={index}
                size="sm"
                variant={action.variant || 'outline'}
                onClick={action.onClick}
                className="flex items-center space-x-2"
              >
                <IconComponent size={16} />
                <span>{action.label}</span>
              </Button>
            );
          })}
          
          {/* Secondary Actions Dropdown */}
          {secondaryActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondaryActions.map((action, index) => {
                  const IconComponent = action.icon;
                  return (
                    <DropdownMenuItem key={index} onClick={action.onClick}>
                      <IconComponent size={16} className="mr-2" />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {children && (
        <div className="flex items-center justify-between">
          {children}
        </div>
      )}
    </div>
  );
}
