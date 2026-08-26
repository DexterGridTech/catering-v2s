import {CatalogItemEditorDrawer, type CatalogItemDrawerProps} from './CatalogItemEditorDrawer';
import {CatalogItemViewDrawer} from './CatalogItemViewDrawer';

export * from './CatalogItemEditorDrawer';
export * from './CatalogItemViewDrawer';

/**
 * Surface router only. The read-only view and the editor are separate trees;
 * this file owns no fact rendering, draft, query or command state.
 */
export function CatalogItemDrawer(props: CatalogItemDrawerProps) {
  // The workbench owns the first-level task. This adapter must not keep a
  // second view/edit state because that lets a child surface diverge from the
  // task reducer and breaks the single-drawer invariant.
  if (props.initialMode === 'edit') return <CatalogItemEditorDrawer {...props} initialMode="edit" />;
  return <CatalogItemViewDrawer {...props} initialMode="view" />;
}
