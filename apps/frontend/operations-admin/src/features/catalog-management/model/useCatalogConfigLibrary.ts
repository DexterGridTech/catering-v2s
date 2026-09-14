import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react';
import type {CatalogLibraryKind} from './catalogWorkspaceTask';

/**
 * The configuration drawer has one business-state owner.  Text being typed is
 * local UI input until submitted; the submitted keyword and lifecycle status
 * are owner-query facts.  A library change deliberately discards the former
 * library's filter and selection so they can never shape another library.
 */
export type CatalogSimpleLibraryStatus = 'ENABLED' | 'DISABLED' | 'VOIDED';

export type CatalogSimpleLibraryFilterState = {
  keywordInput: string;
  appliedKeyword: string;
  status?: CatalogSimpleLibraryStatus;
};

export const initialCatalogSimpleLibraryFilter: CatalogSimpleLibraryFilterState = {
  keywordInput: '',
  appliedKeyword: '',
  status: undefined,
};

export type CatalogDefinitionEditorState = {
  library: 'ATTRIBUTES' | 'ORDER_OPTIONS';
  mode: 'CREATE' | 'EDIT';
  definitionRef?: string;
};

type ConfigLibraryState = {
  currentLibrary: CatalogLibraryKind;
  simpleLibraryFilter: CatalogSimpleLibraryFilterState;
  selectedEntryRef?: string;
  definitionEditor?: CatalogDefinitionEditorState;
};

type ConfigLibraryAction =
  | {type: 'SELECT_LIBRARY'; library: CatalogLibraryKind}
  | {type: 'SET_FILTER_INPUT'; keywordInput: string}
  | {type: 'APPLY_FILTER'}
  | {type: 'CLEAR_FILTER_KEYWORD'}
  | {type: 'SET_FILTER_STATUS'; status?: CatalogSimpleLibraryStatus}
  | {type: 'SET_SELECTED_ENTRY_REF'; entryRef?: string}
  | {type: 'OPEN_DEFINITION_EDITOR'; editor: CatalogDefinitionEditorState}
  | {type: 'CLOSE_DEFINITION_EDITOR'}
  | {type: 'RESET_LIBRARY_CONTEXT'; library?: CatalogLibraryKind};

export function catalogConfigLibraryReducer(
  state: ConfigLibraryState,
  action: ConfigLibraryAction,
): ConfigLibraryState {
  switch (action.type) {
    case 'SELECT_LIBRARY':
      return {
        ...state,
        currentLibrary: action.library,
        simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
        selectedEntryRef: undefined,
        definitionEditor: undefined,
      };
    case 'SET_FILTER_INPUT':
      return {...state, simpleLibraryFilter: {...state.simpleLibraryFilter, keywordInput: action.keywordInput}};
    case 'APPLY_FILTER':
      return {
        ...state,
        simpleLibraryFilter: {
          ...state.simpleLibraryFilter,
          appliedKeyword: state.simpleLibraryFilter.keywordInput.trim(),
        },
      };
    case 'CLEAR_FILTER_KEYWORD':
      return {
        ...state,
        simpleLibraryFilter: {...state.simpleLibraryFilter, keywordInput: '', appliedKeyword: ''},
      };
    case 'SET_FILTER_STATUS':
      return {...state, simpleLibraryFilter: {...state.simpleLibraryFilter, status: action.status}};
    case 'SET_SELECTED_ENTRY_REF':
      return {...state, selectedEntryRef: action.entryRef};
    case 'OPEN_DEFINITION_EDITOR':
      return {...state, definitionEditor: action.editor};
    case 'CLOSE_DEFINITION_EDITOR':
      return {...state, definitionEditor: undefined};
    case 'RESET_LIBRARY_CONTEXT':
      return {
        ...state,
        currentLibrary: action.library ?? state.currentLibrary,
        simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
        selectedEntryRef: undefined,
        definitionEditor: undefined,
      };
    default:
      return state;
  }
}

export function useCatalogConfigLibrary({
  initialLibrary = 'TAG',
  contextKey = '',
}: {
  initialLibrary?: CatalogLibraryKind;
  /** Scope, brand and drawer-open identity. A change must never reuse a former library query or selection. */
  contextKey?: string;
} = {}) {
  const [state, dispatch] = useReducer(catalogConfigLibraryReducer, {
    currentLibrary: initialLibrary,
    simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
  });
  const previousContextKey = useRef(contextKey);
  const contextChanged = previousContextKey.current !== contextKey;
  if (contextChanged) previousContextKey.current = contextKey;
  useEffect(() => {
    if (contextChanged) dispatch({type: 'RESET_LIBRARY_CONTEXT', library: initialLibrary});
  }, [contextChanged, contextKey, initialLibrary]);
  const selectLibrary = useCallback((library: CatalogLibraryKind) => dispatch({type: 'SELECT_LIBRARY', library}), []);
  const setSimpleLibraryKeywordInput = useCallback(
    (keywordInput: string) => dispatch({type: 'SET_FILTER_INPUT', keywordInput}),
    [],
  );
  const applySimpleLibraryKeyword = useCallback(() => dispatch({type: 'APPLY_FILTER'}), []);
  const clearSimpleLibraryKeyword = useCallback(() => dispatch({type: 'CLEAR_FILTER_KEYWORD'}), []);
  const setSimpleLibraryStatus = useCallback(
    (status?: CatalogSimpleLibraryStatus) => dispatch({type: 'SET_FILTER_STATUS', status}),
    [],
  );
  const setSelectedEntryRef = useCallback(
    (entryRef?: string) => dispatch({type: 'SET_SELECTED_ENTRY_REF', entryRef}),
    [],
  );
  const openDefinitionEditor = useCallback(
    (editor: CatalogDefinitionEditorState) => dispatch({type: 'OPEN_DEFINITION_EDITOR', editor}),
    [],
  );
  const closeDefinitionEditor = useCallback(() => dispatch({type: 'CLOSE_DEFINITION_EDITOR'}), []);
  const resetLibraryContext = useCallback(() => dispatch({type: 'RESET_LIBRARY_CONTEXT'}), []);
  return useMemo(() => {
    const effectiveState = contextChanged
      ? {
          ...state,
          currentLibrary: initialLibrary,
          simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
          selectedEntryRef: undefined,
          definitionEditor: undefined,
        }
      : state;
    return {
      ...effectiveState,
      contextChanged,
      selectLibrary,
      setSimpleLibraryKeywordInput,
      applySimpleLibraryKeyword,
      clearSimpleLibraryKeyword,
      setSimpleLibraryStatus,
      setSelectedEntryRef,
      openDefinitionEditor,
      closeDefinitionEditor,
      resetLibraryContext,
    };
  }, [
    applySimpleLibraryKeyword,
    closeDefinitionEditor,
    clearSimpleLibraryKeyword,
    openDefinitionEditor,
    resetLibraryContext,
    selectLibrary,
    setSelectedEntryRef,
    setSimpleLibraryKeywordInput,
    setSimpleLibraryStatus,
    contextChanged,
    initialLibrary,
    state,
  ]);
}
