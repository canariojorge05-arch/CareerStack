import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Pause,
  Calendar,
  FileText,
  User
} from 'lucide-react';

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  pulse?: boolean;
}

const requirementStatusConfig: Record<string, StatusConfig> = {
  'New': {
    label: 'New',
    variant: 'default',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
    icon: FileText,
  },
  'Working': {
    label: 'Working',
    variant: 'default',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200',
    icon: Play,
    pulse: true,
  },
  'Applied': {
    label: 'Applied',
    variant: 'default',
    className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200',
    icon: CheckCircle,
  },
  'Submitted': {
    label: 'Submitted',
    variant: 'default',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200',
    icon: CheckCircle,
  },
  'Interviewed': {
    label: 'Interviewed',
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
    icon: User,
  },
  'Cancelled': {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
    icon: XCircle,
  },
};

const interviewStatusConfig: Record<string, StatusConfig> = {
  'Confirmed': {
    label: 'Confirmed',
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  'Cancelled': {
    label: 'Cancelled',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
  'Re-Scheduled': {
    label: 'Re-Scheduled',
    variant: 'default',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock,
  },
  'Completed': {
    label: 'Completed',
    variant: 'default',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: CheckCircle,
  },
};

const consultantStatusConfig: Record<string, StatusConfig> = {
  'Active': {
    label: 'Active',
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  'Not Active': {
    label: 'Inactive',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Pause,
  },
};

interface StatusBadgeProps {
  status: string;
  type: 'requirement' | 'interview' | 'consultant';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ 
  status, 
  type, 
  size = 'md', 
  showIcon = true, 
  className 
}: StatusBadgeProps) {
  const configs = {
    requirement: requirementStatusConfig,
    interview: interviewStatusConfig,
    consultant: consultantStatusConfig,
  };

  const config = configs[type][status] || {
    label: status,
    variant: 'outline' as const,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const IconComponent = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'font-medium border transition-colors duration-200',
        config.className,
        sizeClasses[size],
        config.pulse && 'animate-pulse',
        className
      )}
    >
      <div className="flex items-center space-x-1">
        {showIcon && IconComponent && (
          <IconComponent size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />
        )}
        <span>{config.label}</span>
      </div>
    </Badge>
  );
}

// Priority Badge Component
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriorityBadge({ priority, size = 'md', className }: PriorityBadgeProps) {
  const priorityConfig = {
    low: {
      label: 'Low',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    medium: {
      label: 'Medium',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    high: {
      label: 'High',
      className: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    urgent: {
      label: 'Urgent',
      className: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
    },
  };

  const config = priorityConfig[priority];
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
