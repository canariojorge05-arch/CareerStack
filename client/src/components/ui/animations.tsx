import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Loading Skeleton Component
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave';
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-slate-200 rounded';
  
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could implement wave animation with CSS
  };

  const style = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'circular' ? '40px' : undefined),
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
    />
  );
}

// Success Animation Component
interface SuccessAnimationProps {
  show: boolean;
  onComplete?: () => void;
  size?: number;
}

export function SuccessAnimation({ show, onComplete, size = 64 }: SuccessAnimationProps) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20 
          }}
          className="flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ 
              duration: 0.6,
              times: [0, 0.6, 1],
              ease: "easeOut"
            }}
            className="bg-green-100 rounded-full p-4"
          >
            <CheckCircle 
              size={size} 
              className="text-green-600"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating Action Button with animations
interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  position = 'bottom-right',
  variant = 'primary',
  size = 'md',
}: FloatingActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-slate-600 hover:bg-slate-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  return (
    <motion.button
      className={cn(
        'fixed z-50 rounded-full shadow-lg transition-all duration-200',
        'flex items-center justify-center',
        positionClasses[position],
        variantClasses[variant],
        sizeClasses[size]
      )}
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <motion.div
        animate={{ rotate: isHovered ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {icon}
      </motion.div>
      
      <AnimatePresence>
        {label && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: position.includes('right') ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: position.includes('right') ? 10 : -10 }}
            className={cn(
              'absolute whitespace-nowrap bg-slate-900 text-white px-3 py-1 rounded text-sm',
              position.includes('right') ? 'right-full mr-3' : 'left-full ml-3'
            )}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Staggered List Animation
interface StaggeredListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}

export function StaggeredList({ children, className, staggerDelay = 0.1 }: StaggeredListProps) {
  return (
    <motion.div className={className}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.4,
            delay: index * staggerDelay,
            ease: "easeOut"
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Progress Indicator with animation
interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  showLabel = false,
  color = 'blue',
}: AnimatedProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-center mb-2">
        {showLabel && (
          <span className="text-sm font-medium text-slate-700">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <motion.div
          className={cn('h-2 rounded-full', colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Notification Toast with animations
interface NotificationToastProps {
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

export function NotificationToast({
  show,
  message,
  type = 'info',
  onClose,
  autoClose = true,
  duration = 4000,
}: NotificationToastProps) {
  useEffect(() => {
    if (show && autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, autoClose, onClose, duration]);

  const typeConfig = {
    success: {
      icon: CheckCircle,
      className: 'bg-green-50 border-green-200 text-green-800',
      iconColor: 'text-green-600',
    },
    error: {
      icon: AlertCircle,
      className: 'bg-red-50 border-red-200 text-red-800',
      iconColor: 'text-red-600',
    },
    warning: {
      icon: AlertCircle,
      className: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    info: {
      icon: Info,
      className: 'bg-blue-50 border-blue-200 text-blue-800',
      iconColor: 'text-blue-600',
    },
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            'fixed top-4 right-4 z-50 max-w-sm w-full',
            'border rounded-lg shadow-lg p-4',
            config.className
          )}
        >
          <div className="flex items-start space-x-3">
            <IconComponent size={20} className={config.iconColor} />
            <div className="flex-1">
              <p className="text-sm font-medium">{message}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hover Card with smooth animations
interface HoverCardProps {
  children: React.ReactNode;
  hoverContent: React.ReactNode;
  className?: string;
  delay?: number;
}

export function HoverCard({ children, hoverContent, className, delay = 0.2 }: HoverCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, delay }}
            className="absolute z-50 top-full left-0 mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-lg"
          >
            {hoverContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pulse Animation for notifications
export function PulseIndicator({ 
  show = true, 
  color = 'blue',
  size = 'md' 
}: { 
  show?: boolean; 
  color?: 'blue' | 'green' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
}) {
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    yellow: 'bg-yellow-600',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  if (!show) return null;

  return (
    <motion.div
      className={cn('rounded-full', colorClasses[color], sizeClasses[size])}
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: [1, 0.7, 1] 
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
}
