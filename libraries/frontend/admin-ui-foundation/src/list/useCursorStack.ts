import {useCallback, useEffect, useState} from 'react';

export type CursorStackOptions = {
  initialCursor?: string;
  resetKey?: string | number | boolean;
};

export type CursorStackState = {
  cursorStack: string[];
  page: number;
  cursor?: string;
  canPrevious: boolean;
  goToPage: (page: number, nextCursor?: string) => void;
  reset: () => void;
};

/**
 * Applies a cursor-page transition without pretending that an unknown cursor
 * can be derived from a page number. Known pages are truncated in one step;
 * only the immediately following page may be appended with its owner cursor.
 */
export function updateCursorStack(current: readonly string[], requestedPage: number, nextCursor?: string): string[] {
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  if (page < current.length) return current.slice(0, page);
  if (page === current.length) return [...current];
  if (page === current.length + 1 && nextCursor) return [...current, nextCursor];
  return [...current];
}

export function useCursorStack({initialCursor = '', resetKey}: CursorStackOptions = {}): CursorStackState {
  const [cursorStack, setCursorStack] = useState<string[]>([initialCursor]);
  const reset = useCallback(() => setCursorStack([initialCursor]), [initialCursor]);
  useEffect(() => reset(), [reset, resetKey]);
  const goToPage = useCallback((page: number, nextCursor?: string) => {
    setCursorStack(current => updateCursorStack(current, page, nextCursor));
  }, []);
  const page = cursorStack.length;
  return {
    cursorStack,
    page,
    cursor: cursorStack[page - 1] || undefined,
    canPrevious: page > 1,
    goToPage,
    reset,
  };
}
