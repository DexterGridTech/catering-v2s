import type {ComponentProps} from 'react';
import type {OperationsPageProps} from '../../../app/routing/model';
import type {CatalogWorkspaceTask} from '../model/catalogWorkspaceTask';
import type {CatalogSurface} from './controllers/CatalogWorkbenchController';
import {BrandCatalogCopyDrawer} from './BrandCatalogCopyDrawer';
import {CatalogBatchActionModal} from './CatalogBatchActionModal';
import {CatalogCategoryActionModal} from './CatalogCategoryActionModal';
import {CatalogDictionaryDrawer} from './CatalogDictionaryDrawer';
import {CatalogItemCreateDrawer} from './CatalogItemCreateDrawer';
import {CatalogItemDrawer} from './CatalogItemDrawer';
import {LocalCatalogCopyDrawer} from './LocalCatalogCopyDrawer';

type Props = {
  workspaceTask: CatalogWorkspaceTask;
  surface: CatalogSurface;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWriteCatalog: boolean;
  detailTarget?: string;
  batchProps: ComponentProps<typeof CatalogBatchActionModal>;
  categoryProps: ComponentProps<typeof CatalogCategoryActionModal>;
  onDetailEdit: () => void;
  onLocalCopy: (source: {itemCode: string; targetShapeKey?: string}) => void;
  onDetailSaved: () => void;
  onDetailClose: () => void;
  onCreateClose: () => void;
  onCreated: (itemCode: string) => void;
  onConfigClose: () => void;
  onCopyClose: () => void;
};

/** Renders first-level task surfaces from the workbench task state; task ownership remains in its controller. */
export function CatalogWorkbenchTaskSurfaces({
  workspaceTask,
  surface,
  queryContext,
  brandRef,
  canWriteCatalog,
  detailTarget,
  batchProps,
  categoryProps,
  onDetailEdit,
  onLocalCopy,
  onDetailSaved,
  onDetailClose,
  onCreateClose,
  onCreated,
  onConfigClose,
  onCopyClose,
}: Props) {
  const copyOpen = workspaceTask.kind === 'COPY';
  const localCopyOpen = copyOpen && workspaceTask.flow === 'LOCAL_SETTINGS';
  const createOpen = workspaceTask.kind === 'CREATE_ITEM';
  const dictionaryOpen = workspaceTask.kind === 'CONFIG';
  const dictionaryKind =
    workspaceTask.kind === 'CONFIG' &&
    (workspaceTask.library === 'TAG' ||
      workspaceTask.library === 'UNIT' ||
      workspaceTask.library === 'SKU_ATTRIBUTE' ||
      workspaceTask.library === 'SKU_ATTRIBUTE_VALUE' ||
      workspaceTask.library === 'PRODUCTION_TAG')
      ? workspaceTask.library
      : 'TAG';
  return (
    <>
      <CatalogBatchActionModal {...batchProps} />
      <CatalogItemDrawer
        itemCode={detailTarget}
        initialMode={workspaceTask.kind === 'EDIT' ? 'edit' : 'view'}
        initialViewTab={workspaceTask.kind === 'VIEW' ? workspaceTask.focus : undefined}
        queryContext={queryContext}
        brandRef={brandRef}
        canWriteCatalog={canWriteCatalog}
        surface={surface}
        onEdit={onDetailEdit}
        onCopy={onLocalCopy}
        onSaved={onDetailSaved}
        onClose={onDetailClose}
      />
      <CatalogItemCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        brandRef={brandRef}
        onClose={onCreateClose}
        onCreated={onCreated}
      />
      <CatalogDictionaryDrawer
        open={dictionaryOpen}
        initialKind={dictionaryKind}
        queryContext={queryContext}
        brandRef={brandRef}
        canWrite={canWriteCatalog}
        onClose={onConfigClose}
      />
      {surface === 'store' && (
        <BrandCatalogCopyDrawer open={copyOpen} queryContext={queryContext} brandRef={brandRef} onClose={onCopyClose} />
      )}
      <LocalCatalogCopyDrawer
        open={localCopyOpen}
        sourceItemCode={workspaceTask.kind === 'COPY' ? (workspaceTask.targetItemCode ?? '') : ''}
        targetShapeKey={workspaceTask.kind === 'COPY' ? workspaceTask.targetShapeKey : undefined}
        queryContext={queryContext}
        brandRef={brandRef}
        onClose={onCopyClose}
      />
      <CatalogCategoryActionModal {...categoryProps} />
    </>
  );
}
