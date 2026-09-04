import {createContentIdempotencyKey, digestFileContent} from '@catering-v2s/admin-ui-foundation';
import {useCallback} from 'react';
import {operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type SalesMenuActivationRequest,
  type SalesMenuArchiveRequest,
  type SalesMenuAssetReleaseReadback,
  type SalesMenuAssetReleaseRequest,
  type SalesMenuAssetStageReadback,
  type SalesMenuAssetStageRequest,
  type SalesMenuCommandReadback,
  type SalesMenuCopyRequest,
  type SalesMenuCreateRequest,
  type SalesMenuDeleteRequest,
  type SalesMenuItemMoveRequest,
  type SalesMenuItemUpdateRequest,
  type SalesMenuItemsAddRequest,
  type SalesMenuManualRestoreRequest,
  type SalesMenuManualSoldOutRequest,
  type SalesMenuPublishRequest,
  type SalesMenuRenameRequest,
  type SalesMenuScheduleUpdateRequest,
  type SalesMenuSectionCreateRequest,
  type SalesMenuSectionMoveRequest,
  type SalesMenuSectionRenameRequest,
  type Uuid,
} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {salesMenuCommandIdempotencyPayload} from './salesMenuModel';

export type SalesMenuPath = {
  groupWorkspaceKey: string;
  storeRef: Uuid;
  salesMenuRef: Uuid;
};

export type SalesMenuSectionPath = SalesMenuPath & {salesSectionRef: Uuid};
export type SalesMenuItemPath = SalesMenuPath & {salesItemRef: Uuid};
export type SalesMenuChannelPath = SalesMenuPath & {channelRef: Uuid};

type MutationTrigger = (request: never) => {unwrap: () => Promise<unknown>};

async function runMutation<Response>(
  operationId: string,
  pathForKey: object,
  bodyForKey: unknown,
  trigger: MutationTrigger,
  requestFactory: (idempotencyKey: string) => unknown,
  correlationId: string,
): Promise<Response> {
  const idempotencyKey = await createContentIdempotencyKey(
    operationId,
    salesMenuCommandIdempotencyPayload(pathForKey, bodyForKey),
  );
  operationsLogger.info({
    event: 'sales-menu.command',
    phase: 'COMMAND',
    outcome: 'STARTED',
    operationId,
    correlationId,
  });
  try {
    const response = (await trigger(requestFactory(idempotencyKey) as never).unwrap()) as Response;
    operationsLogger.info({
      event: 'sales-menu.command',
      phase: 'COMMAND',
      outcome: 'SUCCEEDED',
      operationId,
      correlationId,
    });
    return response;
  } catch (error) {
    operationsLogger.warn({
      event: 'sales-menu.command',
      phase: 'COMMAND',
      outcome: 'FAILED',
      operationId,
      correlationId,
    });
    throw error;
  }
}

export function useSalesMenuCommands() {
  const [addItems, addItemsState] = operationsRtk.useAddOperationsSalesMenuItemsMutation();
  const [archiveMenu, archiveMenuState] = operationsRtk.useArchiveOperationsSalesMenuMutation();
  const [copyMenu, copyMenuState] = operationsRtk.useCopyOperationsSalesMenuMutation();
  const [createMenu, createMenuState] = operationsRtk.useCreateOperationsSalesMenuMutation();
  const [createSection, createSectionState] = operationsRtk.useCreateOperationsSalesMenuSectionMutation();
  const [deleteItem, deleteItemState] = operationsRtk.useDeleteOperationsSalesMenuItemMutation();
  const [deleteSection, deleteSectionState] = operationsRtk.useDeleteOperationsSalesMenuSectionMutation();
  const [moveItem, moveItemState] = operationsRtk.useMoveOperationsSalesMenuItemMutation();
  const [moveSection, moveSectionState] = operationsRtk.useMoveOperationsSalesMenuSectionMutation();
  const [publishMenu, publishMenuState] = operationsRtk.usePublishOperationsSalesMenuMutation();
  const [releaseAsset, releaseAssetState] = operationsRtk.useReleaseOperationsSalesMenuStagedAssetMutation();
  const [renameMenu, renameMenuState] = operationsRtk.useRenameOperationsSalesMenuMutation();
  const [renameSection, renameSectionState] = operationsRtk.useRenameOperationsSalesMenuSectionMutation();
  const [restoreSale, restoreSaleState] = operationsRtk.useRestoreOperationsSalesMenuItemSaleMutation();
  const [setActivation, setActivationState] = operationsRtk.useSetOperationsSalesMenuActivationMutation();
  const [setSoldOut, setSoldOutState] = operationsRtk.useSetOperationsSalesMenuItemSoldOutMutation();
  const [stageAsset, stageAssetState] = operationsRtk.useStageOperationsSalesMenuAssetMutation();
  const [updateItem, updateItemState] = operationsRtk.useUpdateOperationsSalesMenuItemMutation();
  const [updateSchedule, updateScheduleState] = operationsRtk.useUpdateOperationsSalesMenuScheduleMutation();

  const create = useCallback(
    (path: Pick<SalesMenuPath, 'groupWorkspaceKey' | 'storeRef'>, body: SalesMenuCreateRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.createOperationsSalesMenu,
        path,
        body,
        createMenu as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.createOperationsSalesMenu(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.storeRef),
      ),
    [createMenu],
  );
  const copy = useCallback(
    (path: SalesMenuPath, body: SalesMenuCopyRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.copyOperationsSalesMenu,
        path,
        body,
        copyMenu as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.copyOperationsSalesMenu(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesMenuRef),
      ),
    [copyMenu],
  );
  const rename = useCallback(
    (path: SalesMenuPath, body: SalesMenuRenameRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.renameOperationsSalesMenu,
        path,
        body,
        renameMenu as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.renameOperationsSalesMenu(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesMenuRef),
      ),
    [renameMenu],
  );
  const archive = useCallback(
    (path: SalesMenuPath, body: SalesMenuArchiveRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.archiveOperationsSalesMenu,
        path,
        body,
        archiveMenu as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.archiveOperationsSalesMenu(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesMenuRef),
      ),
    [archiveMenu],
  );
  const activate = useCallback(
    (path: SalesMenuChannelPath, body: SalesMenuActivationRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.setOperationsSalesMenuActivation,
        path,
        body,
        setActivation as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.setOperationsSalesMenuActivation(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesMenuRef),
      ),
    [setActivation],
  );
  const schedule = useCallback(
    (path: SalesMenuPath, body: SalesMenuScheduleUpdateRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuSchedule,
        path,
        body,
        updateSchedule as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.updateOperationsSalesMenuSchedule(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesMenuRef),
      ),
    [updateSchedule],
  );
  const createSalesSection = useCallback(
    (path: SalesMenuPath, body: SalesMenuSectionCreateRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.createOperationsSalesMenuSection,
        path,
        body,
        createSection as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.createOperationsSalesMenuSection(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesMenuRef),
      ),
    [createSection],
  );
  const renameSalesSection = useCallback(
    (path: SalesMenuSectionPath, body: SalesMenuSectionRenameRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.renameOperationsSalesMenuSection,
        path,
        body,
        renameSection as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.renameOperationsSalesMenuSection(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesSectionRef),
      ),
    [renameSection],
  );
  const removeSalesSection = useCallback(
    (path: SalesMenuSectionPath, body: SalesMenuDeleteRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.deleteOperationsSalesMenuSection,
        path,
        body,
        deleteSection as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.deleteOperationsSalesMenuSection(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesSectionRef),
      ),
    [deleteSection],
  );
  const reorderSection = useCallback(
    (path: SalesMenuSectionPath, body: SalesMenuSectionMoveRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.moveOperationsSalesMenuSection,
        path,
        body,
        moveSection as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.moveOperationsSalesMenuSection(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesSectionRef),
      ),
    [moveSection],
  );
  const add = useCallback(
    (path: SalesMenuSectionPath, body: SalesMenuItemsAddRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.addOperationsSalesMenuItems,
        path,
        body,
        addItems as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.addOperationsSalesMenuItems(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesSectionRef),
      ),
    [addItems],
  );
  const update = useCallback(
    (path: SalesMenuItemPath, body: SalesMenuItemUpdateRequest, assetBindGrants?: Record<string, string>) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
        path,
        body,
        updateItem as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.updateOperationsSalesMenuItem(path, {
            body,
            headers: {
              'Idempotency-Key': key,
              ...(assetBindGrants && Object.keys(assetBindGrants).length
                ? {'X-Sales-Menu-Asset-Bind-Grants': JSON.stringify(assetBindGrants)}
                : {}),
            },
          }),
        String(path.salesItemRef),
      ),
    [updateItem],
  );
  const remove = useCallback(
    (path: SalesMenuItemPath, body: SalesMenuDeleteRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.deleteOperationsSalesMenuItem,
        path,
        body,
        deleteItem as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.deleteOperationsSalesMenuItem(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesItemRef),
      ),
    [deleteItem],
  );
  const reorderItem = useCallback(
    (path: SalesMenuItemPath, body: SalesMenuItemMoveRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.moveOperationsSalesMenuItem,
        path,
        body,
        moveItem as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.moveOperationsSalesMenuItem(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesItemRef),
      ),
    [moveItem],
  );
  const publish = useCallback(
    (path: SalesMenuPath, body: SalesMenuPublishRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.publishOperationsSalesMenu,
        path,
        body,
        publishMenu as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.publishOperationsSalesMenu(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesMenuRef),
      ),
    [publishMenu],
  );
  const soldOut = useCallback(
    (path: SalesMenuChannelPath & {salesItemRef: Uuid}, body: SalesMenuManualSoldOutRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.setOperationsSalesMenuItemSoldOut,
        path,
        body,
        setSoldOut as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.setOperationsSalesMenuItemSoldOut(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesItemRef),
      ),
    [setSoldOut],
  );
  const restore = useCallback(
    (path: SalesMenuChannelPath & {salesItemRef: Uuid}, body: SalesMenuManualRestoreRequest) =>
      runMutation<SalesMenuCommandReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.restoreOperationsSalesMenuItemSale,
        path,
        body,
        restoreSale as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.restoreOperationsSalesMenuItemSale(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.salesItemRef),
      ),
    [restoreSale],
  );
  const stage = useCallback(
    async (path: SalesMenuItemPath, file: File, expectedDraftVersion: number) => {
      const contentDigest = await digestFileContent(file);
      const body: SalesMenuAssetStageRequest = {
        expectedDraftVersion,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        contentDigest,
        content: file,
      };
      return runMutation<SalesMenuAssetStageReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.stageOperationsSalesMenuAsset,
        path,
        {
          expectedDraftVersion,
          fileName: file.name,
          mediaType: body.mediaType,
          contentDigest,
        },
        stageAsset as unknown as MutationTrigger,
        key => operationsAdminRtkRequest.stageOperationsSalesMenuAsset(path, {body, headers: {'Idempotency-Key': key}}),
        String(path.salesItemRef),
      );
    },
    [stageAsset],
  );
  const release = useCallback(
    (path: SalesMenuItemPath & {assetRef: Uuid}, body: SalesMenuAssetReleaseRequest) =>
      runMutation<SalesMenuAssetReleaseReadback>(
        OPERATIONS_ADMIN_OPERATION_IDS.releaseOperationsSalesMenuStagedAsset,
        path,
        body,
        releaseAsset as unknown as MutationTrigger,
        key =>
          operationsAdminRtkRequest.releaseOperationsSalesMenuStagedAsset(path, {
            body,
            headers: {'Idempotency-Key': key},
          }),
        String(path.assetRef),
      ),
    [releaseAsset],
  );

  return {
    create,
    copy,
    rename,
    archive,
    activate,
    schedule,
    createSection: createSalesSection,
    renameSection: renameSalesSection,
    deleteSection: removeSalesSection,
    moveSection: reorderSection,
    addItems: add,
    updateItem: update,
    deleteItem: remove,
    moveItem: reorderItem,
    publish,
    soldOut,
    restore,
    stage,
    release,
    isBusy: [
      addItemsState,
      archiveMenuState,
      copyMenuState,
      createMenuState,
      createSectionState,
      deleteItemState,
      deleteSectionState,
      moveItemState,
      moveSectionState,
      publishMenuState,
      releaseAssetState,
      renameMenuState,
      renameSectionState,
      restoreSaleState,
      setActivationState,
      setSoldOutState,
      stageAssetState,
      updateItemState,
      updateScheduleState,
    ].some(state => state.isLoading),
  };
}
