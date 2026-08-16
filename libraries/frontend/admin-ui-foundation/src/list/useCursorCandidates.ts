import {useCallback, useEffect, useRef, useState, type UIEvent} from 'react';

const DEFAULT_DEBOUNCE_MS = 250;
const SCROLL_THRESHOLD_PX = 16;

export type CursorCandidatePageMetadata = {
  pageSize?: number | null;
  total?: number | null;
};

export type CursorCandidatesOptions<T> = {
  queryText?: string;
  resetKey?: string | number | boolean;
  pageSize?: number;
  debounceMs?: number;
  keyOf: (item: T) => string;
};

export type CursorCandidatesState<T> = {
  debouncedQueryText?: string;
  page: number;
  pageSize: number;
  total: number;
  items: T[];
  acceptPage: (items: readonly T[], metadata?: CursorCandidatePageMetadata | null) => void;
  onPopupScroll: (event: UIEvent<HTMLElement>, isFetching: boolean) => void;
};

export function normalizeCursorCandidateQuery(value?: string) {
  return value?.trim() || undefined;
}

export function mergeCursorCandidateItems<T>(
  current: readonly T[],
  incoming: readonly T[],
  keyOf: (item: T) => string,
): T[] {
  const byKey = new Map(current.map(item => [keyOf(item), item]));
  for (const item of incoming) byKey.set(keyOf(item), item);
  return [...byKey.values()];
}

/**
 * Shared state machine for server-backed candidate selectors. The caller
 * controls the owner query; this primitive owns debouncing, page reset,
 * cursor-like accumulation, deduplication, and one common scroll threshold.
 */
export function useCursorCandidates<T>({
  queryText,
  resetKey,
  pageSize = 50,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  keyOf,
}: CursorCandidatesOptions<T>): CursorCandidatesState<T> {
  const [debouncedQueryText, setDebouncedQueryText] = useState<string | undefined>(() =>
    normalizeCursorCandidateQuery(queryText),
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const keyOfRef = useRef(keyOf);
  const pageRef = useRef(page);
  const totalRef = useRef(total);
  const pageSizeRef = useRef(Math.max(1, pageSize));
  const pendingPageRef = useRef<number | undefined>(undefined);
  keyOfRef.current = keyOf;
  pageRef.current = page;
  totalRef.current = total;
  pageSizeRef.current = Math.max(1, pageSize);

  useEffect(() => {
    setPage(1);
    setTotal(0);
    setItems([]);
    pendingPageRef.current = undefined;
  }, [queryText, resetKey]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQueryText(normalizeCursorCandidateQuery(queryText)), debounceMs);
    return () => clearTimeout(timeout);
  }, [debounceMs, queryText]);

  const acceptPage = useCallback((incoming: readonly T[], metadata?: CursorCandidatePageMetadata | null) => {
    const activePage = pageRef.current;
    const nextTotal = metadata?.total ?? 0;
    const nextPageSize = Math.max(1, metadata?.pageSize ?? pageSizeRef.current);
    totalRef.current = nextTotal;
    pageSizeRef.current = nextPageSize;
    setTotal(nextTotal);
    setItems(current => mergeCursorCandidateItems(activePage === 1 ? [] : current, incoming, keyOfRef.current));
  }, []);

  const onPopupScroll = useCallback((event: UIEvent<HTMLElement>, isFetching: boolean) => {
    const eventTarget = event.target as {scrollTop?: number; clientHeight?: number; scrollHeight?: number} | null;
    const target =
      eventTarget &&
      typeof eventTarget.scrollTop === 'number' &&
      typeof eventTarget.clientHeight === 'number' &&
      typeof eventTarget.scrollHeight === 'number'
        ? eventTarget
        : event.currentTarget;
    const scrollTop = target.scrollTop ?? 0;
    const clientHeight = target.clientHeight ?? 0;
    const scrollHeight = target.scrollHeight ?? 0;
    if (scrollTop + clientHeight < scrollHeight - SCROLL_THRESHOLD_PX) return;
    const activePage = pageRef.current;
    if (
      isFetching ||
      !totalRef.current ||
      activePage * pageSizeRef.current >= totalRef.current ||
      pendingPageRef.current === activePage
    )
      return;
    pendingPageRef.current = activePage;
    setPage(current => (current === activePage ? current + 1 : current));
  }, []);

  return {debouncedQueryText, page, pageSize: pageSizeRef.current, total, items, acceptPage, onPopupScroll};
}
