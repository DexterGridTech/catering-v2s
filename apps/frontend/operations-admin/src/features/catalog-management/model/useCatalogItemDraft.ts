import {useCallback, useState, type SetStateAction} from 'react';

export const CATALOG_ITEM_DRAFT_SECTIONS = [
  'basic',
  'identifiers',
  'sku-specifications-pricing',
  'attributes',
  'order-options',
  'production-prompts',
  'inventory-bom',
  'composite-content',
] as const;

export type CatalogItemDraftSection = (typeof CATALOG_ITEM_DRAFT_SECTIONS)[number];

export type CatalogItemDraftSectionState = {
  activeSection: CatalogItemDraftSection;
  dirtySections: Record<CatalogItemDraftSection, boolean>;
  sectionErrors: Partial<Record<CatalogItemDraftSection, string>>;
};

type UseCatalogItemDraftOptions<T> = {
  initialPayload: T;
};

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
 * Owns the in-memory whole-item draft while the editor is open. Closing the
 * editor resets this state; server facts remain in RTK and transient overlay
 * state remains in the editor component.
 */
export function useCatalogItemDraft<T>({initialPayload}: UseCatalogItemDraftOptions<T>) {
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
  };
}
