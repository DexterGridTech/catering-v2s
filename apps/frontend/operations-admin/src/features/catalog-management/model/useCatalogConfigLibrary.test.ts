import {describe, expect, it} from 'vitest';
import {catalogConfigLibraryReducer, initialCatalogSimpleLibraryFilter} from './useCatalogConfigLibrary';

describe('catalog configuration library state', () => {
  const initial = {
    currentLibrary: 'TAG' as const,
    simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
  };

  it('keeps text local until the maintainer submits the search', () => {
    const typing = catalogConfigLibraryReducer(initial, {type: 'SET_FILTER_INPUT', keywordInput: '  饮品  '});
    expect(typing.simpleLibraryFilter).toEqual({keywordInput: '  饮品  ', appliedKeyword: '', status: undefined});
    expect(catalogConfigLibraryReducer(typing, {type: 'APPLY_FILTER'}).simpleLibraryFilter).toEqual({
      keywordInput: '  饮品  ',
      appliedKeyword: '饮品',
      status: undefined,
    });
  });

  it('keeps current-library filter and selected fact in one state owner, then clears both on a library change', () => {
    const filtered = catalogConfigLibraryReducer(
      catalogConfigLibraryReducer(
        catalogConfigLibraryReducer(initial, {type: 'SET_FILTER_STATUS', status: 'DISABLED'}),
        {type: 'SET_SELECTED_ENTRY_REF', entryRef: 'attribute-ref'},
      ),
      {type: 'SELECT_LIBRARY', library: 'UNIT'},
    );
    expect(filtered).toEqual({
      currentLibrary: 'UNIT',
      simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
      selectedEntryRef: undefined,
    });
  });

  it('owns complex-definition mode and selection until the library changes or the editor closes', () => {
    const editing = catalogConfigLibraryReducer(initial, {
      type: 'OPEN_DEFINITION_EDITOR',
      editor: {library: 'ATTRIBUTES', mode: 'EDIT', definitionRef: 'attribute-ref'},
    });
    expect(editing.definitionEditor).toEqual({library: 'ATTRIBUTES', mode: 'EDIT', definitionRef: 'attribute-ref'});
    expect(catalogConfigLibraryReducer(editing, {type: 'CLOSE_DEFINITION_EDITOR'}).definitionEditor).toBeUndefined();
    expect(
      catalogConfigLibraryReducer(editing, {type: 'SELECT_LIBRARY', library: 'ORDER_OPTIONS'}).definitionEditor,
    ).toBeUndefined();
  });

  it('clears only the submitted search when the search box is cleared, preserving the separately chosen status', () => {
    const filtered = {
      currentLibrary: 'PRODUCTION_TAG' as const,
      simpleLibraryFilter: {keywordInput: '饮品', appliedKeyword: '饮品', status: 'ENABLED' as const},
    };
    expect(catalogConfigLibraryReducer(filtered, {type: 'CLEAR_FILTER_KEYWORD'}).simpleLibraryFilter).toEqual({
      keywordInput: '',
      appliedKeyword: '',
      status: 'ENABLED',
    });
  });

  it('clears submitted filters and selected fact when the configuration drawer closes', () => {
    const populated = {
      currentLibrary: 'PRODUCTION_TAG' as const,
      simpleLibraryFilter: {keywordInput: '饮品', appliedKeyword: '饮品', status: 'ENABLED' as const},
      selectedEntryRef: 'tag-ref',
    };
    expect(catalogConfigLibraryReducer(populated, {type: 'RESET_LIBRARY_CONTEXT'})).toEqual({
      currentLibrary: 'PRODUCTION_TAG',
      simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
      selectedEntryRef: undefined,
    });
  });

  it('restores the requested library before a new drawer context can query', () => {
    const populated = {
      currentLibrary: 'TAG' as const,
      simpleLibraryFilter: {keywordInput: '旧筛选', appliedKeyword: '旧筛选', status: 'ENABLED' as const},
      selectedEntryRef: 'old-entry',
    };
    expect(catalogConfigLibraryReducer(populated, {type: 'RESET_LIBRARY_CONTEXT', library: 'UNIT'})).toMatchObject({
      currentLibrary: 'UNIT',
      simpleLibraryFilter: initialCatalogSimpleLibraryFilter,
      selectedEntryRef: undefined,
    });
  });
});
