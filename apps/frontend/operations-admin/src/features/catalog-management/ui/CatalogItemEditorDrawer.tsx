import {CatalogItemEditorWorkspace, type CatalogItemDrawerProps} from './CatalogItemEditorWorkspace';

export * from './CatalogItemEditorWorkspace';

/**
 * Surface adapter: the workspace owns editor rendering, draft state and
 * command coordination; this entry only selects the edit surface.
 */
export function CatalogItemEditorDrawer(props: CatalogItemDrawerProps) {
  return <CatalogItemEditorWorkspace {...props} initialMode="edit" />;
}
