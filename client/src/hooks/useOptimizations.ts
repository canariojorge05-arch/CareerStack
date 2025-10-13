import { useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';

export function useOptimizedUpdate<T>(
  callback: (value: T) => void,
  delay = 300
) {
  const debouncedCallback = useCallback(
    debounce(callback, delay),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      debouncedCallback.cancel();
    };
  }, [debouncedCallback]);

  return debouncedCallback;
}

export function useMemoizedValue<T>(value: T, delay = 500) {
  const ref = useRef<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      ref.current = value;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return ref.current;
}

export function useResourceCleanup() {
  const cleanupFns = useRef<(() => void)[]>([]);

  const addCleanup = useCallback((fn: () => void) => {
    cleanupFns.current.push(fn);
  }, []);

  useEffect(() => {
    return () => {
      cleanupFns.current.forEach(fn => fn());
      cleanupFns.current = [];
    };
  }, []);

  return addCleanup;
}