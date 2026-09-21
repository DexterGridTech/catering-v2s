import {createContentIdempotencyKey, digestFileContent} from '@catering-v2s/admin-ui-foundation';
import {operationsClient} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type StoreServicePoint,
  type StoreServicePointArea,
  type StoreServicePointAssetStageReadback,
  type StoreServicePointStatus,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {
  type AreaEditor,
  type AreaFormValues,
  type PointEditor,
  type PointFormValues,
  type QrFormValues,
  type StoreServicePointImage,
  serializeStoreServicePointExtensionValues,
  STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION,
  pointTypeForArea,
} from './storeServicePointModel';

type StoreCommandContext = {
  groupWorkspaceKey: string;
  storeWireRef: StoreServicePoint['storeRef'];
};

export async function saveStoreServicePointArea(
  context: StoreCommandContext & {editor: AreaEditor; operation: 'create' | 'update'; values: AreaFormValues},
) {
  const {editor, operation, values} = context;
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    ...(editor.area ? {areaRef: wireUuid(editor.area.areaRef)} : {}),
  };
  const body =
    operation === 'create'
      ? {name: values.name.trim(), code: values.code.trim(), areaType: values.areaType}
      : {
          name: values.name.trim(),
          code: values.code.trim(),
          areaType: values.areaType,
          status: editor.area?.status ?? 'ENABLED',
          expectedVersion: editor.area?.version ?? 0,
        };
  const operationId =
    operation === 'create'
      ? OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointArea
      : OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePointArea;
  const key = await createContentIdempotencyKey(operationId, {path, body});
  if (operation === 'create') {
    return operationsClient.postOperationsStoreServicePointArea(path as never, {
      body: body as never,
      headers: {'Idempotency-Key': key},
    });
  }
  return operationsClient.patchOperationsStoreServicePointArea(path as never, {
    body: body as never,
    headers: {'Idempotency-Key': key},
  });
}

export async function changeStoreServicePointAreaStatus(
  context: StoreCommandContext & {area: StoreServicePointArea; status: StoreServicePointStatus},
) {
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    areaRef: wireUuid(context.area.areaRef),
  };
  const body = {status: context.status, expectedVersion: context.area.version};
  const key = await createContentIdempotencyKey(
    OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointAreaStatus,
    {
      path,
      body,
    },
  );
  return operationsClient.postOperationsStoreServicePointAreaStatus(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function moveStoreServicePointArea(
  context: StoreCommandContext & {area: StoreServicePointArea; direction: 'UP' | 'DOWN'},
) {
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    areaRef: wireUuid(context.area.areaRef),
  };
  const body = {direction: context.direction, expectedVersion: context.area.version};
  const key = await createContentIdempotencyKey(
    OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointAreaOrder,
    {
      receiptVersion: STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION,
      path,
      body,
    },
  );
  return operationsClient.postOperationsStoreServicePointAreaOrder(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function stageStoreServicePointImage(
  context: StoreCommandContext & {file: File},
): Promise<StoreServicePointAssetStageReadback> {
  const contentDigest = await digestFileContent(context.file);
  const path = {groupWorkspaceKey: context.groupWorkspaceKey, storeRef: context.storeWireRef};
  const body = {
    fileName: context.file.name,
    mediaType: context.file.type || 'application/octet-stream',
    contentDigest,
    content: context.file,
  };
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.stageStoreServicePointImage, {
    path,
    fileName: context.file.name,
    contentDigest,
  });
  return operationsClient.stageStoreServicePointImage(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function releaseStoreServicePointImages(context: StoreCommandContext & {items: StoreServicePointImage[]}) {
  const failures: unknown[] = [];
  for (const item of context.items.filter(
    current => current.staged && current.assetRef && current.version !== undefined,
  )) {
    const path = {
      groupWorkspaceKey: context.groupWorkspaceKey,
      storeRef: context.storeWireRef,
      assetRef: wireUuid(item.assetRef as string),
    };
    const body = {expectedAssetVersion: item.version as number};
    try {
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.releaseStagedStoreServicePointImage,
        {
          path,
          body,
        },
      );
      await operationsClient.releaseStagedStoreServicePointImage(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}

export async function saveStoreServicePoint(
  context: StoreCommandContext & {
    editor: PointEditor;
    selectedAreaRef: string;
    extensionDefinitionRevision: number;
    extensionDefinition: Parameters<typeof serializeStoreServicePointExtensionValues>[0];
    image?: StoreServicePointImage;
    values: PointFormValues;
  },
) {
  const pointType = pointTypeForArea(context.editor.areaType);
  const body = {
    name: context.values.name.trim(),
    code: context.values.code.trim(),
    pointType,
    seatCapacity: pointType === 'TABLE' ? (context.values.seatCapacity ?? null) : null,
    tableShape: pointType === 'TABLE' ? (context.values.tableShape ?? null) : null,
    reservable: pointType === 'TABLE' ? (context.values.reservable ?? null) : null,
    imageAssetRef: pointType === 'TABLE' && context.image?.assetRef ? wireUuid(context.image.assetRef) : null,
    imageBindGrant: pointType === 'TABLE' ? (context.image?.bindGrant ?? null) : null,
    extensionValues: serializeStoreServicePointExtensionValues(
      context.extensionDefinition,
      context.values.extensionValues,
    ),
    extensionRuleRevision: context.extensionDefinitionRevision,
    ...(context.editor.point
      ? {status: context.editor.point.status, expectedVersion: context.editor.point.version}
      : {}),
  };
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    ...(context.editor.point
      ? {servicePointRef: wireUuid(context.editor.point.pointRef)}
      : {areaRef: wireUuid(context.selectedAreaRef)}),
  };
  const operationId = context.editor.point
    ? OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePoint
    : OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePoint;
  const key = await createContentIdempotencyKey(operationId, {path, body});
  if (context.editor.point) {
    return operationsClient.patchOperationsStoreServicePoint(path as never, {
      body: body as never,
      headers: {'Idempotency-Key': key},
    });
  }
  return operationsClient.postOperationsStoreServicePoint(path as never, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function changeStoreServicePointStatus(
  context: StoreCommandContext & {point: StoreServicePoint; status: StoreServicePointStatus},
) {
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    servicePointRef: wireUuid(context.point.pointRef),
  };
  const body = {status: context.status, expectedVersion: context.point.version};
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointStatus, {
    path,
    body,
  });
  return operationsClient.postOperationsStoreServicePointStatus(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function moveStoreServicePoint(
  context: StoreCommandContext & {point: StoreServicePoint; direction: 'UP' | 'DOWN'},
) {
  const path = {
    groupWorkspaceKey: context.groupWorkspaceKey,
    storeRef: context.storeWireRef,
    servicePointRef: wireUuid(context.point.pointRef),
  };
  const body = {direction: context.direction, expectedVersion: context.point.version};
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointOrder, {
    receiptVersion: STORE_SERVICE_POINT_ORDER_RECEIPT_VERSION,
    path,
    body,
  });
  return operationsClient.postOperationsStoreServicePointOrder(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}

export async function saveStoreQrConfiguration(
  context: StoreCommandContext & {configurationVersion: number; values: QrFormValues},
) {
  const path = {groupWorkspaceKey: context.groupWorkspaceKey, storeRef: context.storeWireRef};
  const body = {
    enabled: Boolean(context.values.enabled),
    channelRef: context.values.channelRef ? wireUuid(context.values.channelRef) : null,
    expectedVersion: context.configurationVersion,
  };
  const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreQrConfiguration, {
    path,
    body,
  });
  return operationsClient.patchOperationsStoreQrConfiguration(path, {
    body,
    headers: {'Idempotency-Key': key},
  });
}
