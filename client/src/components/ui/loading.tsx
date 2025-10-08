// Comprehensive loading components export
export { LoadingSpinner } from './loading-spinner';
export { LoadingButton } from './loading-button';
export { PageLoader } from './page-loader';
export { LoadingOverlay } from './loading-overlay';
export { Skeleton } from './skeleton';
export { 
  CardSkeleton, 
  ResumeCardSkeleton, 
  StatsCardSkeleton 
} from './card-skeleton';
export { 
  TableSkeleton, 
  ListSkeleton 
} from './table-skeleton';

// Loading state hooks and utilities
import { useState, useEffect } from 'react';

/**
 * Hook for managing loading states with automatic timeout
 */
export function useLoadingState(initialState = false, timeout?: number) {
  const [isLoading, setIsLoading] = useState(initialState);

  useEffect(() => {
    if (isLoading && timeout) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [isLoading, timeout]);

  return [isLoading, setIsLoading] as const;
}

/**
 * Hook for managing async operations with loading states
 */
export function useAsyncOperation<T = any>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = async (asyncFn: () => Promise<T>) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setIsLoading(false);
    setError(null);
    setData(null);
  };

  return {
    isLoading,
    error,
    data,
    execute,
    reset
  };
}

/**
 * Hook for managing multiple loading states
 */
export function useMultipleLoadingStates<T extends Record<string, boolean>>(
  initialStates: T
) {
  const [loadingStates, setLoadingStates] = useState<T>(initialStates);

  const setLoading = (key: keyof T, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  };

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return {
    loadingStates,
    setLoading,
    isAnyLoading
  };
}
