import {useCallback, useEffect, useMemo, useState, type SetStateAction} from 'react';

export const CATALOG_ITEM_DRAFT_SECTIONS = [
  'basic',
  'identifiers',
  'sku-specifications-pricing',
  'attributes',
  'order-options',
  'production-prompts',
  'inventory-bom',
  'composite-content',
  'governance',
] as const;

export type CatalogItemDraftSection = (typeof CATALOG_ITEM_DRAFT_SECTIONS)[number];

export type CatalogItemDraftSectionState = {
  activeSection: CatalogItemDraftSection;
  dirtySections: Record<CatalogItemDraftSection, boolean>;
  sectionErrors: Partial<Record<CatalogItemDraftSection, string>>;
};

export type CatalogDraftRecord<T> = {
  schemaVersion: 2;
  scopeRef: string;
  brandRef: string;
  itemCode: string;
  baselineVersion: number;
  savedAt: number;
  payload: T;
  sectionState?: CatalogItemDraftSectionState;
};

type UseCatalogItemDraftOptions<T> = {
  scopeRef?: string;
  brandRef?: string;
  itemCode?: string;
  baselineVersion?: number;
  open: boolean;
  initialPayload: T;
  onDiagnostic?: (event: {phase: string; outcome: string; itemCode?: string}) => void;
};

const STORAGE_PREFIX = 'catalog-item-draft:';

function storageKey(scopeRef: string, brandRef: string, itemCode: string, baselineVersion: number): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(scopeRef)}:${encodeURIComponent(brandRef)}:${encodeURIComponent(itemCode)}:${baselineVersion}`;
}

type DraftReadResult<T> = {record?: CatalogDraftRecord<T>; corrupt: boolean};

function readRecord<T>(key: string): DraftReadResult<T> {
  if (typeof window === 'undefined') return {corrupt: false};
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return {corrupt: false};
    const value = JSON.parse(raw) as Partial<CatalogDraftRecord<T>>;
    if (
      value.schemaVersion !== 2 ||
      typeof value.scopeRef !== 'string' ||
      typeof value.brandRef !== 'string' ||
      typeof value.itemCode !== 'string' ||
      !Number.isInteger(value.baselineVersion)
    ) {
      return {corrupt: true};
    }
    if (!value.payload || typeof value.payload !== 'object') return {corrupt: true};
    return {record: value as CatalogDraftRecord<T>, corrupt: false};
  } catch {
    return {corrupt: true};
  }
}

type DraftRecoveryStatus = 'CLEAN' | 'RECOVERABLE' | 'STALE_SERVER_VERSION' | 'CORRUPT';

function readSameItemDrafts<T>(scopeRef: string, brandRef: string, itemCode: string, currentKey: string) {
  if (typeof window === 'undefined')
    return {
      candidate: undefined as CatalogDraftRecord<T> | undefined,
      candidateKey: undefined as string | undefined,
      corrupt: false,
    };
  const prefix = `${STORAGE_PREFIX}${encodeURIComponent(scopeRef)}:${encodeURIComponent(brandRef)}:${encodeURIComponent(itemCode)}:`;
  let candidate: CatalogDraftRecord<T> | undefined;
  let candidateKey: string | undefined;
  let corrupt = false;
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key || key === currentKey || !key.startsWith(prefix)) continue;
    const result = readRecord<T>(key);
    corrupt ||= result.corrupt;
    if (result.record && (!candidate || result.record.savedAt > candidate.savedAt)) {
      candidate = result.record;
      candidateKey = key;
    }
  }
  return {candidate, candidateKey, corrupt};
}

function emptySectionState(): CatalogItemDraftSectionState {
  return {
    activeSection: 'basic',
    dirtySections: Object.fromEntries(CATALOG_ITEM_DRAFT_SECTIONS.map(section => [section, false])) as Record<
      CatalogItemDraftSection,
      boolean
    >,
    sectionErrors: {},
  };
}

/**
 * Owns the recoverable whole-item draft, while server facts remain in RTK and
 * transient overlay state remains in the editor component.
 */
export function useCatalogItemDraft<T>({
  scopeRef,
  brandRef,
  itemCode,
  baselineVersion,
  open,
  initialPayload,
  onDiagnostic,
}: UseCatalogItemDraftOptions<T>) {
  const key = useMemo(
    () =>
      scopeRef && itemCode && baselineVersion !== undefined
        ? storageKey(scopeRef, brandRef ?? '', itemCode, baselineVersion)
        : undefined,
    [baselineVersion, brandRef, itemCode, scopeRef],
  );
  const [restoreCandidate, setRestoreCandidate] = useState<CatalogDraftRecord<T>>();
  const [restoreCandidateKey, setRestoreCandidateKey] = useState<string>();
  const [restoreStatus, setRestoreStatus] = useState<DraftRecoveryStatus>('CLEAN');
  const [restoreProblem, setRestoreProblem] = useState<string>();
  const [draft, setDraft] = useState<T>(initialPayload);
  const [sectionState, setSectionState] = useState<CatalogItemDraftSectionState>(emptySectionState);

  const replace = useCallback((next: T) => setDraft(next), []);
  const update = useCallback((next: SetStateAction<T>) => setDraft(next), []);
  const updateField = useCallback(
    <K extends keyof T>(key: K, next: SetStateAction<T[K]>, section?: CatalogItemDraftSection) => {
      setDraft(current => ({
        ...current,
        [key]: typeof next === 'function' ? (next as (current: T[K]) => T[K])(current[key]) : next,
      }));
      if (section) {
        setSectionState(current => ({
          ...current,
          dirtySections: {...current.dirtySections, [section]: true},
        }));
      }
    },
    [],
  );
  /**
   * A fact-family editor submits its typed patch as one slice.  The draft hook
   * owns both the merge and the section-dirty transition, so adding a field to
   * an existing slice never requires another workspace-level setter.
   */
  const updateFields = useCallback((patch: Partial<T>, section?: CatalogItemDraftSection) => {
    setDraft(current => ({...current, ...patch}));
    if (section) {
      setSectionState(current => ({
        ...current,
        dirtySections: {...current.dirtySections, [section]: true},
      }));
    }
  }, []);
  const setActiveSection = useCallback((activeSection: CatalogItemDraftSection) => {
    setSectionState(current => ({...current, activeSection}));
  }, []);
  const markSectionDirty = useCallback((section: CatalogItemDraftSection) => {
    setSectionState(current => ({
      ...current,
      dirtySections: {...current.dirtySections, [section]: true},
    }));
  }, []);
  const setSectionError = useCallback((section: CatalogItemDraftSection, error?: string) => {
    setSectionState(current => {
      const sectionErrors = {...current.sectionErrors};
      if (error) sectionErrors[section] = error;
      else delete sectionErrors[section];
      return {...current, sectionErrors};
    });
  }, []);
  const resetSectionState = useCallback((next?: Partial<CatalogItemDraftSectionState>) => {
    const empty = emptySectionState();
    setSectionState({
      ...empty,
      ...next,
      dirtySections: {...empty.dirtySections, ...(next?.dirtySections ?? {})},
      sectionErrors: {...(next?.sectionErrors ?? {})},
    });
  }, []);

  useEffect(() => {
    if (!open || !key || !itemCode || !scopeRef) {
      setRestoreCandidate(undefined);
      setRestoreCandidateKey(undefined);
      setRestoreStatus('CLEAN');
      setRestoreProblem(undefined);
      return;
    }
    const result = readRecord<T>(key);
    const older = result.record
      ? {
          candidate: undefined as CatalogDraftRecord<T> | undefined,
          candidateKey: undefined as string | undefined,
          corrupt: false,
        }
      : readSameItemDrafts<T>(scopeRef, brandRef ?? '', itemCode, key);
    const candidate = result.record ?? older.candidate;
    const candidateKey = result.record ? key : older.candidateKey;
    const stale = Boolean(candidate && baselineVersion !== undefined && candidate.baselineVersion !== baselineVersion);
    const corrupt = result.corrupt || older.corrupt;
    setRestoreCandidate(candidate);
    setRestoreCandidateKey(candidateKey ?? undefined);
    setRestoreStatus(candidate ? (stale ? 'STALE_SERVER_VERSION' : 'RECOVERABLE') : corrupt ? 'CORRUPT' : 'CLEAN');
    setRestoreProblem(corrupt && !candidate ? '上次未完成的编辑内容无法读取，请放弃后继续编辑当前商品。' : undefined);
    onDiagnostic?.({
      phase: 'DRAFT_RECOVERY',
      outcome: candidate ? (stale ? 'STALE_SERVER_VERSION' : 'CANDIDATE_FOUND') : corrupt ? 'CORRUPT' : 'NO_CANDIDATE',
      itemCode,
    });
  }, [baselineVersion, brandRef, itemCode, key, onDiagnostic, open, scopeRef]);

  const persist = useCallback(
    (payload: T) => {
      if (!key || !scopeRef || !itemCode || baselineVersion === undefined || typeof window === 'undefined')
        return false;
      const record: CatalogDraftRecord<T> = {
        schemaVersion: 2,
        scopeRef,
        brandRef: brandRef ?? '',
        itemCode,
        baselineVersion,
        savedAt: Date.now(),
        payload,
        sectionState,
      };
      try {
        window.sessionStorage.setItem(key, JSON.stringify(record));
        return true;
      } catch {
        onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: 'PERSIST_FAILED', itemCode});
        return false;
      }
    },
    [baselineVersion, brandRef, itemCode, key, onDiagnostic, scopeRef, sectionState],
  );

  const clear = useCallback(() => {
    const candidateKey = restoreCandidateKey ?? key;
    if (!candidateKey || typeof window === 'undefined') return;
    window.sessionStorage.removeItem(candidateKey);
    setRestoreCandidate(undefined);
    setRestoreCandidateKey(undefined);
    setRestoreStatus('CLEAN');
    setRestoreProblem(undefined);
    onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: 'CLEARED', itemCode});
  }, [itemCode, key, onDiagnostic, restoreCandidateKey]);

  const acceptRestore = useCallback(() => {
    const candidate = restoreCandidate;
    if (candidate && baselineVersion !== undefined && candidate.baselineVersion !== baselineVersion) {
      onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: 'STALE_BLOCKED', itemCode});
      return undefined;
    }
    if (candidate?.sectionState) setSectionState(candidate.sectionState);
    setRestoreCandidate(undefined);
    setRestoreCandidateKey(undefined);
    setRestoreStatus('CLEAN');
    onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: candidate ? 'ACCEPTED' : 'NO_CANDIDATE', itemCode});
    return candidate?.payload;
  }, [baselineVersion, itemCode, onDiagnostic, restoreCandidate]);

  const dismissRestore = useCallback(() => {
    setRestoreCandidate(undefined);
    setRestoreStatus('CLEAN');
    onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: 'VIEW_LATEST', itemCode});
  }, [itemCode, onDiagnostic]);

  const discardRestore = useCallback(() => {
    clear();
    onDiagnostic?.({phase: 'DRAFT_RECOVERY', outcome: 'DISCARDED', itemCode});
  }, [clear, itemCode, onDiagnostic]);

  return {
    draft,
    replace,
    update,
    updateField,
    updateFields,
    sectionState,
    setActiveSection,
    markSectionDirty,
    setSectionError,
    resetSectionState,
    restoreCandidate,
    restoreStatus,
    restoreProblem,
    persist,
    clear,
    acceptRestore,
    discardRestore,
    dismissRestore,
  };
}
