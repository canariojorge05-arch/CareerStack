import { useState, useMemo } from 'react';

export interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface PaginationState {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationControls {
  page: number;
  pageSize: number;
  offset: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

/**
 * Custom hook for pagination logic
 * Handles page state, calculations, and navigation
 */
export function usePagination(
  totalItems: number,
  options: PaginationOptions = {}
): PaginationControls {
  const {
    initialPage = 1,
    initialPageSize = 50,
    pageSizeOptions = [25, 50, 100],
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Calculate derived values
  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize]
  );
  const hasNextPage = useMemo(() => page < totalPages, [page, totalPages]);
  const hasPreviousPage = useMemo(() => page > 1, [page]);

  // Navigation functions
  const goToPage = (newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    setPage(clampedPage);
  };

  const nextPage = () => {
    if (hasNextPage) {
      setPage(page + 1);
    }
  };

  const previousPage = () => {
    if (hasPreviousPage) {
      setPage(page - 1);
    }
  };

  const setPageSize = (newSize: number) => {
    // Reset to page 1 when changing page size
    setPage(1);
    setPageSizeState(newSize);
  };

  const reset = () => {
    setPage(initialPage);
    setPageSizeState(initialPageSize);
  };

  return {
    page,
    pageSize,
    offset,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    reset,
  };
}
