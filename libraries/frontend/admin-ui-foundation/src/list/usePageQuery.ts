import {useCallback, useEffect, useRef, useState} from 'react';

export type PageQueryIdentityInput = {
  operationId: string;
  scope?: unknown;
  filters?: unknown;
  sort?: unknown;
  page?: number;
  pageSize?: number;
};

export type CursorQueryIdentityInput = Omit<PageQueryIdentityInput, 'page'> & {
  cursor?: string;
};

export type PageQueryState = {
  page: number;
  pageSize: number;
  queryIdentity: string;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
};

export function normalizePage(value: number | undefined, fallback = 1): number {
  if (!Number.isFinite(value)) return Math.max(1, Math.floor(fallback));
  return Math.max(1, Math.floor(value as number));
}

export function normalizePageSize(value: number | undefined, fallback = 10): number {
  if (!Number.isFinite(value)) return Math.max(1, Math.floor(fallback));
  return Math.max(1, Math.floor(value as number));
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`);
  return `{${entries.join(',')}}`;
}

export function createPageQueryIdentity(input: PageQueryIdentityInput): string {
  return stableSerialize({
    mode: 'page',
    operationId: input.operationId,
    scope: input.scope ?? null,
    filters: input.filters ?? null,
    sort: input.sort ?? null,
    page: normalizePage(input.page),
    pageSize: normalizePageSize(input.pageSize),
  });
}

export function createCursorQueryIdentity(input: CursorQueryIdentityInput): string {
  return stableSerialize({
    mode: 'cursor',
    operationId: input.operationId,
    scope: input.scope ?? null,
    filters: input.filters ?? null,
    sort: input.sort ?? null,
    cursor: input.cursor ?? null,
    pageSize: normalizePageSize(input.pageSize),
  });
}

export function isCurrentQueryIdentity(requestIdentity: string, currentIdentity: string): boolean {
  return requestIdentity === currentIdentity;
}

export function usePageQuery({
  queryIdentity,
  initialPage = 1,
  initialPageSize = 10,
}: {
  queryIdentity: string;
  initialPage?: number;
  initialPageSize?: number;
}): PageQueryState {
  const firstPage = normalizePage(initialPage);
  const defaultPageSize = normalizePageSize(initialPageSize);
  const [page, setPageState] = useState(firstPage);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const identityRef = useRef(queryIdentity);

  useEffect(() => {
    if (identityRef.current === queryIdentity) return;
    identityRef.current = queryIdentity;
    setPageState(firstPage);
  }, [firstPage, queryIdentity]);

  const setPage = useCallback((nextPage: number) => setPageState(normalizePage(nextPage)), []);
  const setPageSize = useCallback(
    (nextPageSize: number) => {
      setPageSizeState(normalizePageSize(nextPageSize));
      setPageState(firstPage);
    },
    [firstPage],
  );
  const reset = useCallback(() => {
    setPageState(firstPage);
    setPageSizeState(defaultPageSize);
  }, [defaultPageSize, firstPage]);

  return {page, pageSize, queryIdentity, setPage, setPageSize, reset};
}
