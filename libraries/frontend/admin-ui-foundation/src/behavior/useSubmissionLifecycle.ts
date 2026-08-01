import {useCallback, useRef} from 'react';

/**
 * Keeps one idempotency key for one non-Drawer business submission. A caller
 * resets it only when the user changes intent, so transport retries replay the
 * same command rather than creating a second command.
 */
export function useSubmissionLifecycle() {
  const key = useRef<string | undefined>(undefined);
  const getIdempotencyKey = useCallback(() => {
    if (!key.current) key.current = `ui-${globalThis.crypto.randomUUID()}`;
    return key.current;
  }, []);
  const markBusinessIntentChanged = useCallback(() => { key.current = undefined; }, []);
  const reset = useCallback(() => { key.current = undefined; }, []);
  return {getIdempotencyKey, markBusinessIntentChanged, reset};
}
