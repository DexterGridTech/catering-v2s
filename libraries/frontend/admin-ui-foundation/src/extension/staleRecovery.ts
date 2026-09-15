import {useEffect, useRef} from 'react';
import {createAsyncGenerationGuard} from '../behavior/asyncGeneration';

export type ExtensionFilterStaleRecoveryOptions = {
  scopeKey: string;
  stale: boolean;
  staleRevision?: number | null;
  recover: () => void;
};

export function createExtensionFilterStaleRecoveryGate() {
  const recoveredScopes = new Set<string>();
  return {
    claim(scopeKey: string, _staleRevision?: number | null): boolean {
      if (recoveredScopes.has(scopeKey)) return false;
      recoveredScopes.add(scopeKey);
      return true;
    },
  };
}

export type ExtensionFilterRecoveryToken = {
  scopeKey: string;
  generation: number;
  expectedRevision: number | null | undefined;
};

/**
 * Keeps the latest stale lower bound and rejects late recovery callbacks for
 * an explicit query, reset, or scope change. Pages own visible flags; this
 * foundation state owns the shared recovery identity rules.
 */
export function createExtensionFilterRecoveryState() {
  const generation = createAsyncGenerationGuard();
  let currentScopeKey: string | undefined;
  let latestStaleRevision: number | null | undefined;

  return {
    enterScope(scopeKey: string): void {
      if (currentScopeKey === scopeKey) return;
      currentScopeKey = scopeKey;
      latestStaleRevision = undefined;
      generation.invalidate();
    },
    rememberStaleRevision(scopeKey: string, revision: number | null | undefined): void {
      if (currentScopeKey === scopeKey) latestStaleRevision = revision;
    },
    begin(scopeKey: string, directRevision?: number | null): ExtensionFilterRecoveryToken {
      if (currentScopeKey !== scopeKey) {
        currentScopeKey = scopeKey;
        latestStaleRevision = undefined;
        generation.invalidate();
      }
      return {
        scopeKey,
        generation: generation.begin(),
        expectedRevision: directRevision === undefined ? latestStaleRevision : directRevision,
      };
    },
    invalidate(scopeKey: string): void {
      if (currentScopeKey === scopeKey) generation.invalidate();
    },
    isCurrent(token: ExtensionFilterRecoveryToken): boolean {
      return currentScopeKey === token.scopeKey && generation.isCurrent(token.generation);
    },
  };
}

/**
 * Runs a stale extension-filter recovery at most once for each list scope.
 * Manual retry is owned by the page and does not call this automatic gate.
 * The page owns the scope-specific state reset and definition refetch; the
 * foundation only prevents a stale response from creating an endless loop.
 */
export function useExtensionFilterStaleRecovery({
  scopeKey,
  stale,
  staleRevision,
  recover,
}: ExtensionFilterStaleRecoveryOptions): void {
  const recoveryGate = useRef<ReturnType<typeof createExtensionFilterStaleRecoveryGate> | undefined>(undefined);
  if (!recoveryGate.current) recoveryGate.current = createExtensionFilterStaleRecoveryGate();

  useEffect(() => {
    if (!stale || !recoveryGate.current!.claim(scopeKey, staleRevision)) return;
    recover();
  }, [recover, scopeKey, stale, staleRevision]);
}

/**
 * A forced definition read is usable for stale recovery only when it returns
 * the revision advertised by the stale response or a newer one. Missing or
 * malformed revisions fail closed so the list cannot fall back to a core-only
 * query with extension conditions still present.
 */
export function isExtensionDefinitionRevisionAtLeast(
  definition: {revision?: unknown} | null | undefined,
  minimumRevision: number | null | undefined,
): boolean {
  return Boolean(
    definition &&
    typeof definition.revision === 'number' &&
    Number.isSafeInteger(definition.revision) &&
    definition.revision >= 0 &&
    typeof minimumRevision === 'number' &&
    Number.isSafeInteger(minimumRevision) &&
    minimumRevision >= 0 &&
    definition.revision >= minimumRevision,
  );
}
