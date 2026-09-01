import {CatalogDictionaryDrawerState, type CatalogDictionaryDrawerProps} from './CatalogDictionaryDrawerState';

/**
 * Configuration surface assembly boundary. The workbench places the
 * first-level configuration task; an item editor may place the same shell as
 * its sole configuration child task. Commands, reads and state remain in the state
 * adapter so this host never owns another task lifecycle.
 */
export function CatalogDictionaryDrawer(props: CatalogDictionaryDrawerProps) {
  return <CatalogDictionaryDrawerState {...props} />;
}

export type {DictionaryKind} from './CatalogDictionaryDrawerState';
