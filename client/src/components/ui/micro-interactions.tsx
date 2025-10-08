import { useState, useEffect } from 'react';
import { LoadingSpinner } from './loading-spinner';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Typing indicator for real-time feedback
export function TypingIndicator({ isTyping }: { isTyping: boolean }) {
  if (!isTyping) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>Processing...</span>
    </div>
  );
}

// Progress dots for multi-step processes
export function ProgressDots({ 
  steps, 
  currentStep, 
  className 
}: { 
  steps: string[]; 
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
            index < currentStep 
              ? "bg-green-500 text-white" 
              : index === currentStep 
              ? "bg-primary text-primary-foreground animate-pulse" 
              : "bg-muted text-muted-foreground"
          )}>
            {index < currentStep ? (
              <CheckCircle size={16} />
            ) : (
              index + 1
            )}
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              "w-12 h-0.5 mx-2 transition-all duration-300",
              index < currentStep ? "bg-green-500" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// Animated counter for stats
export function AnimatedCounter({ 
  value, 
  duration = 1000,
  className 
}: { 
  value: number; 
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setDisplayValue(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
}

// Pulse loader for real-time updates
export function PulseLoader({ 
  text = "Loading...",
  className 
}: { 
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div className="w-4 h-4 bg-primary rounded-full animate-ping absolute" />
        <div className="w-4 h-4 bg-primary rounded-full" />
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

// Status indicator with transitions
export function StatusIndicator({ 
  status, 
  messages 
}: { 
  status: 'idle' | 'loading' | 'success' | 'error';
  messages: Record<typeof status, string>;
}) {
  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <LoadingSpinner size="sm" />;
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <Info className="text-muted-foreground" size={16} />;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'loading':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center gap-2 transition-all duration-300">
      {getIcon()}
      <span className={cn("text-sm transition-colors duration-300", getTextColor())}>
        {messages[status]}
      </span>
    </div>
  );
}

// Skeleton text with shimmer effect
export function ShimmerText({ 
  lines = 3, 
  className 
}: { 
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-pulse",
            i === lines - 1 ? "w-3/4" : "w-full"
          )}
          style={{
            backgroundSize: '200% 100%',
            animation: `shimmer 1.5s ease-in-out infinite ${i * 0.1}s`,
          }}
        />
      ))}
      {/* @ts-expect-error: styled-jsx's 'jsx' prop is not recognized by default TS types */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Floating action feedback
export function FloatingFeedback({ 
  message, 
  type = 'info',
  duration = 3000,
  onClose 
}: {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-2 duration-300",
      getStyles()
    )}>
      <div className="flex items-center gap-2">
        {type === 'success' && <CheckCircle size={16} />}
        {type === 'error' && <AlertCircle size={16} />}
        {type === 'info' && <Info size={16} />}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
