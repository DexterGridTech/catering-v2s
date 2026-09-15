import type {ComponentProps} from 'react';
import {CatalogItemDrawer} from '../../catalog-management/ui/CatalogItemDrawer';
import {SalesMenuCandidateDrawer} from './SalesMenuCandidateDrawer';
import {SalesMenuCreateModal} from './SalesMenuCreateModal';
import {SalesMenuItemDetailDrawer} from './SalesMenuItemDetailDrawer';
import {SalesMenuItemEditorDrawer} from './SalesMenuItemEditorDrawer';
import {SalesMenuManagerDrawer} from './SalesMenuManagerDrawer';
import {SalesMenuPublishDrawer} from './SalesMenuPublishDrawer';

type Props = {
  manager: ComponentProps<typeof SalesMenuManagerDrawer>;
  create: ComponentProps<typeof SalesMenuCreateModal>;
  candidate: ComponentProps<typeof SalesMenuCandidateDrawer>;
  editor: ComponentProps<typeof SalesMenuItemEditorDrawer>;
  catalogItem: ComponentProps<typeof CatalogItemDrawer>;
  detail: ComponentProps<typeof SalesMenuItemDetailDrawer>;
  publish: ComponentProps<typeof SalesMenuPublishDrawer>;
};

/**
 * Assembles first-level sales-menu task surfaces. Page state and command
 * ownership stay in SalesMenuPage; each surface owns only its own UI/read
 * lifecycle, matching the catalog-management surface assembler pattern.
 */
export function SalesMenuTaskSurfaces({manager, create, candidate, editor, catalogItem, detail, publish}: Props) {
  return (
    <>
      <SalesMenuManagerDrawer {...manager} />
      <SalesMenuCreateModal {...create} />
      <SalesMenuCandidateDrawer {...candidate} />
      <SalesMenuItemEditorDrawer {...editor} />
      <CatalogItemDrawer {...catalogItem} />
      <SalesMenuItemDetailDrawer {...detail} />
      <SalesMenuPublishDrawer {...publish} />
    </>
  );
}
