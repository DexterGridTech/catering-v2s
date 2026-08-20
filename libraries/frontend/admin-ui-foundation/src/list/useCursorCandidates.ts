import {useCallback, useEffect, useRef, useState, type UIEvent} from 'react';

const DEFAULT_DEBOUNCE_MS = 250;
const SCROLL_THRESHOLD_PX = 16;

export type CursorCandidatePageMetadata = {
  pageSize?: number | null;
  total?: number | null;
  /** Opaque continuation returned by a cursor-backed candidate endpoint. */
  nextCursor?: string | null;
};

export type CursorPage<T> = {
  items: readonly T[];
  nextCursor?: string | null;
  total?: number | null;
  pageSize?: number | null;
};

export type CollectCursorPagesOptions<T> = {
  readPage: (cursor: string | undefined, pageSize: number) => Promise<CursorPage<T>>;
  initialPage?: CursorPage<T>;
  pageSize?: number;
  keyOf: (item: T) => string;
  maxPages?: number;
};

export type CollectedCursorPages<T> = {
  items: T[];
  total: number;
  pageSize: number;
  pageCount: number;
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
  cursor?: string;
  nextCursor?: string;
  acceptPage: (items: readonly T[], metadata?: CursorCandidatePageMetadata | null) => void;
  loadNext: (isFetching: boolean) => void;
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
 * Reads a cursor-backed collection to completion for non-React consumers.
 * The caller owns the request; this primitive owns continuation, duplicate
 * suppression, and malformed cursor-loop detection.
 */
export async function collectCursorPages<T>({
  readPage,
  initialPage,
  pageSize = 50,
  keyOf,
  maxPages = 1000,
}: CollectCursorPagesOptions<T>): Promise<CollectedCursorPages<T>> {
  const requestedPageSize = Math.max(1, pageSize);
  const seenCursors = new Set<string>();
  const items = new Map<string, T>();
  let currentCursor: string | undefined;
  let currentPageSize = requestedPageSize;
  let total = 0;
  let pageCount = 0;
  let page = initialPage;

  while (pageCount < maxPages) {
    page ??= await readPage(currentCursor, currentPageSize);
    pageCount += 1;
    currentPageSize = Math.max(1, page.pageSize ?? currentPageSize);
    total = page.total ?? total;
    for (const item of page.items) items.set(keyOf(item), item);

    const nextCursor = page.nextCursor || undefined;
    if (!nextCursor) return {items: [...items.values()], total, pageSize: currentPageSize, pageCount};
    if (nextCursor === currentCursor || seenCursors.has(nextCursor)) {
      throw new Error('CURSOR_PAGE_LOOP');
    }
    seenCursors.add(nextCursor);
    currentCursor = nextCursor;
    page = undefined;
  }

  throw new Error('CURSOR_PAGE_LIMIT_EXCEEDED');
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
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const keyOfRef = useRef(keyOf);
  const pageRef = useRef(page);
  const totalRef = useRef(total);
  const pageSizeRef = useRef(Math.max(1, pageSize));
  const pendingPageRef = useRef<number | undefined>(undefined);
  const nextCursorRef = useRef<string | undefined>(nextCursor);
  const cursorModeRef = useRef(false);
  keyOfRef.current = keyOf;
  pageRef.current = page;
  totalRef.current = total;
  pageSizeRef.current = Math.max(1, pageSize);
  nextCursorRef.current = nextCursor;

  useEffect(() => {
    setPage(1);
    setTotal(0);
    setItems([]);
    setCursor(undefined);
    setNextCursor(undefined);
    cursorModeRef.current = false;
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
    const hasCursorMetadata = Boolean(metadata && Object.prototype.hasOwnProperty.call(metadata, 'nextCursor'));
    totalRef.current = nextTotal;
    pageSizeRef.current = nextPageSize;
    if (hasCursorMetadata) {
      cursorModeRef.current = true;
      const returnedCursor = metadata?.nextCursor ?? undefined;
      nextCursorRef.current = returnedCursor;
      setNextCursor(returnedCursor);
    }
    pendingPageRef.current = undefined;
    setTotal(nextTotal);
    setItems(current => mergeCursorCandidateItems(activePage === 1 ? [] : current, incoming, keyOfRef.current));
  }, []);

  const loadNext = useCallback((isFetching: boolean) => {
    const activePage = pageRef.current;
    if (isFetching || pendingPageRef.current === activePage) return;
    if (cursorModeRef.current) {
      const continuation = nextCursorRef.current;
      if (!continuation) return;
      pendingPageRef.current = activePage;
      setCursor(continuation);
      setPage(current => (current === activePage ? current + 1 : current));
      return;
    }
    if (!totalRef.current || activePage * pageSizeRef.current >= totalRef.current) return;
    pendingPageRef.current = activePage;
    setPage(current => (current === activePage ? current + 1 : current));
  }, []);

  const onPopupScroll = useCallback(
    (event: UIEvent<HTMLElement>, isFetching: boolean) => {
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
      loadNext(isFetching);
    },
    [loadNext],
  );

  return {
    debouncedQueryText,
    page,
    pageSize: pageSizeRef.current,
    total,
    items,
    cursor,
    nextCursor,
    acceptPage,
    loadNext,
    onPopupScroll,
  };
}
