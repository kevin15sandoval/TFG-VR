// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOK - Paginación
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

export interface PaginationResult<T> {
  paged: T[];
  page: number;
  totalPages: number;
  pageSize: number;
  setPage: (p: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export function usePagination<T>(
  items: T[],
  pageSize: number
): PaginationResult<T> {
  const [page, setPage] = useState(1);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const totalPages = Math.ceil(items.length / pageSize);

  return {
    paged,
    page,
    totalPages,
    pageSize,
    setPage,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
