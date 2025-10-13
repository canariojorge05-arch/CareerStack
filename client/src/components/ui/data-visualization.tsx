import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Progress Ring Component
interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  className,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = (value / max) * 100;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-blue-500';
    if (percentage >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-500 ease-out', getColor(percentage))}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500">of {max}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Trend Indicator Component
interface TrendIndicatorProps {
  value: number;
  previousValue?: number;
  format?: (value: number) => string;
  showPercentage?: boolean;
  className?: string;
}

export function TrendIndicator({
  value,
  previousValue,
  format = (v) => v.toString(),
  showPercentage = true,
  className,
}: TrendIndicatorProps) {
  if (previousValue === undefined) {
    return (
      <div className={cn('flex items-center space-x-1 text-slate-500', className)}>
        <Minus size={16} />
        <span className="text-sm">No data</span>
      </div>
    );
  }

  const change = value - previousValue;
  const percentageChange = previousValue !== 0 ? (change / previousValue) * 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const colorClass = isNeutral
    ? 'text-slate-500'
    : isPositive
    ? 'text-green-600'
    : 'text-red-600';

  return (
    <div className={cn('flex items-center space-x-1', colorClass, className)}>
      <TrendIcon size={16} />
      <span className="text-sm font-medium">
        {showPercentage ? `${Math.abs(percentageChange).toFixed(1)}%` : format(Math.abs(change))}
      </span>
    </div>
  );
}

// Status Distribution Chart
interface StatusDistributionProps {
  data: { status: string; count: number; color: string }[];
  title?: string;
  className?: string;
}

export function StatusDistribution({ data, title, className }: StatusDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-500">
                      {percentage.toFixed(1)}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.count}
                    </Badge>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Timeline Component
interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  type: 'created' | 'updated' | 'completed' | 'cancelled' | 'scheduled';
  icon?: React.ComponentType<{ size?: number }>;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return FileText;
      case 'updated':
        return AlertCircle;
      case 'completed':
        return CheckCircle;
      case 'cancelled':
        return AlertCircle;
      case 'scheduled':
        return Calendar;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'created':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'updated':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-600 border-red-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, index) => {
        const IconComponent = event.icon || getEventIcon(event.type);
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="flex items-start space-x-3">
            <div className="relative flex-shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                  getEventColor(event.type)
                )}
              >
                <IconComponent size={14} />
              </div>
              {!isLast && (
                <div className="absolute top-8 left-1/2 w-0.5 h-6 bg-slate-200 transform -translate-x-1/2" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-900">{event.title}</h4>
                <time className="text-xs text-slate-500">
                  {event.date.toLocaleDateString()}
                </time>
              </div>
              {event.description && (
                <p className="text-sm text-slate-600 mt-1">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  previousValue,
  icon: IconComponent,
  trend,
  trendValue,
  description,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mb-2">{value}</p>
            
            {(trend || trendValue) && (
              <div className="flex items-center space-x-2">
                {trend && (
                  <TrendIndicator
                    value={typeof value === 'number' ? value : 0}
                    previousValue={typeof previousValue === 'number' ? previousValue : undefined}
                  />
                )}
                {trendValue && (
                  <span className="text-sm text-slate-500">{trendValue}</span>
                )}
              </div>
            )}
            
            {description && (
              <p className="text-xs text-slate-500 mt-2">{description}</p>
            )}
          </div>
          
          <div className="flex-shrink-0">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <IconComponent size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Activity Heatmap Component (simplified version)
interface HeatmapData {
  date: string;
  value: number;
}

interface ActivityHeatmapProps {
  data: HeatmapData[];
  title?: string;
  className?: string;
}

export function ActivityHeatmap({ data, title, className }: ActivityHeatmapProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  const getIntensity = (value: number) => {
    const intensity = maxValue > 0 ? value / maxValue : 0;
    if (intensity === 0) return 'bg-slate-100';
    if (intensity <= 0.25) return 'bg-blue-200';
    if (intensity <= 0.5) return 'bg-blue-400';
    if (intensity <= 0.75) return 'bg-blue-600';
    return 'bg-blue-800';
  };

  return (
    <Card className={className}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {data.slice(0, 49).map((item, index) => (
            <div
              key={index}
              className={cn(
                'w-4 h-4 rounded-sm transition-colors',
                getIntensity(item.value)
              )}
              title={`${item.date}: ${item.value} activities`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-slate-100 rounded-sm" />
            <div className="w-3 h-3 bg-blue-200 rounded-sm" />
            <div className="w-3 h-3 bg-blue-400 rounded-sm" />
            <div className="w-3 h-3 bg-blue-600 rounded-sm" />
            <div className="w-3 h-3 bg-blue-800 rounded-sm" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
