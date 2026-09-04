import type {ComponentProps} from 'react';
import {SalesMenuCandidateDrawer} from './SalesMenuCandidateDrawer';
import {SalesMenuItemDetailDrawer} from './SalesMenuItemDetailDrawer';
import {SalesMenuItemEditorDrawer} from './SalesMenuItemEditorDrawer';
import {SalesMenuManagerDrawer} from './SalesMenuManagerDrawer';
import {SalesMenuPublishDrawer} from './SalesMenuPublishDrawer';

type Props = {
  manager: ComponentProps<typeof SalesMenuManagerDrawer>;
  candidate: ComponentProps<typeof SalesMenuCandidateDrawer>;
  editor: ComponentProps<typeof SalesMenuItemEditorDrawer>;
  detail: ComponentProps<typeof SalesMenuItemDetailDrawer>;
  publish: ComponentProps<typeof SalesMenuPublishDrawer>;
};

/**
 * Assembles first-level sales-menu task surfaces. Page state and command
 * ownership stay in SalesMenuPage; each surface owns only its own UI/read
 * lifecycle, matching the catalog-management surface assembler pattern.
 */
export function SalesMenuTaskSurfaces({manager, candidate, editor, detail, publish}: Props) {
  return (
    <>
      <SalesMenuManagerDrawer {...manager} />
      <SalesMenuCandidateDrawer {...candidate} />
      <SalesMenuItemEditorDrawer {...editor} />
      <SalesMenuItemDetailDrawer {...detail} />
      <SalesMenuPublishDrawer {...publish} />
    </>
  );
}
