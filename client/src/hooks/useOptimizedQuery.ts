import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  endpoint: string;
  params?: Record<string, any>;
  select?: string[]; // Fields to select for reduced payload
  dependencies?: any[]; // Dependencies for query invalidation
  backgroundRefetch?: boolean;
  optimisticUpdates?: boolean;
}

export function useOptimizedQuery<T = any>({
  endpoint,
  params = {},
  select,
  dependencies = [],
  backgroundRefetch = true,
  optimisticUpdates = false,
  ...queryOptions
}: OptimizedQueryOptions<T>) {
  const queryClient = useQueryClient();

  // Create optimized query key
  const queryKey = useMemo(() => {
    const baseKey = [endpoint];
    if (Object.keys(params).length > 0) {
      baseKey.push(params);
    }
    if (select && select.length > 0) {
      baseKey.push({ select: select.join(',') });
    }
    return baseKey;
  }, [endpoint, params, select]);

  // Optimized query function with field selection
  const queryFn = useCallback(async () => {
    const searchParams = new URLSearchParams();
    
    // Add regular params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });

    // Add field selection for reduced payload
    if (select && select.length > 0) {
      searchParams.append('select', select.join(','));
    }

    const url = searchParams.toString() 
      ? `${endpoint}?${searchParams.toString()}`
      : endpoint;

    const response = await apiRequest('GET', url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}`);
    }
    return response.json();
  }, [endpoint, params, select]);

  // Enhanced query with optimizations
  const query = useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: backgroundRefetch,
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      return failureCount < 3;
    },
    ...queryOptions,
  });

  // Optimistic update helper
  const optimisticUpdate = useCallback((updater: (oldData: T) => T) => {
    if (!optimisticUpdates) return;
    
    queryClient.setQueryData(queryKey, updater);
  }, [queryClient, queryKey, optimisticUpdates]);

  // Prefetch related data
  const prefetchRelated = useCallback((relatedEndpoint: string, relatedParams = {}) => {
    const relatedKey = [relatedEndpoint, relatedParams];
    queryClient.prefetchQuery({
      queryKey: relatedKey,
      queryFn: async () => {
        const searchParams = new URLSearchParams(relatedParams);
        const url = searchParams.toString() 
          ? `${relatedEndpoint}?${searchParams.toString()}`
          : relatedEndpoint;
        
        const response = await apiRequest('GET', url);
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes for prefetched data
    });
  }, [queryClient]);

  // Invalidate related queries
  const invalidateRelated = useCallback(() => {
    dependencies.forEach(dep => {
      queryClient.invalidateQueries({ queryKey: [dep] });
    });
  }, [queryClient, dependencies]);

  return {
    ...query,
    optimisticUpdate,
    prefetchRelated,
    invalidateRelated,
  };
}

// Hook for batch operations
export function useBatchQuery<T = any>(endpoints: string[], commonParams = {}) {
  const queries = endpoints.map(endpoint => 
    useOptimizedQuery<T>({ 
      endpoint, 
      params: commonParams,
      staleTime: 30000, // 30 seconds for batch queries
    })
  );

  const isLoading = queries.some(q => q.isLoading);
  const isError = queries.some(q => q.isError);
  const data = queries.map(q => q.data);
  const errors = queries.map(q => q.error).filter(Boolean);

  return {
    isLoading,
    isError,
    data,
    errors,
    queries,
  };
}

// Hook for infinite scroll with optimization
export function useInfiniteOptimizedQuery<T = any>({
  endpoint,
  params = {},
  pageSize = 50,
  select,
}: {
  endpoint: string;
  params?: Record<string, any>;
  pageSize?: number;
  select?: string[];
}) {
  const queryKey = useMemo(() => [endpoint, 'infinite', params, select], [endpoint, params, select]);

  return useQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams({
        ...params,
        page: String(pageParam),
        limit: String(pageSize),
      });

      if (select && select.length > 0) {
        searchParams.append('select', select.join(','));
      }

      const response = await apiRequest('GET', `${endpoint}?${searchParams.toString()}`);
      return response.json();
    },
    getNextPageParam: (lastPage: any) => {
      if (lastPage.pagination && lastPage.pagination.hasMore) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });
}
