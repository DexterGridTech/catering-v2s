import {MoreOutlined, PlusOutlined} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  QRCode,
  theme,
} from 'antd';
import type {MenuProps, TableColumnsType} from 'antd';
import {
  AdminImageCollectionEditor,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  adminWideDrawerSurfaceProps,
  adminListState,
  createContentIdempotencyKey,
  CursorPagination,
  digestFileContent,
  NameCodeText,
  testId,
  useCursorStack,
  useDetailDrawer,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {type Dayjs} from 'dayjs';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  type ExtensionDefinition,
  type JsonValue,
  type StoreQrChannelCandidate,
  type StoreQrConfigurationView,
  type StoreServicePoint,
  type StoreServicePointArea,
  type StoreServicePointAreaType,
  type StoreServicePointShape,
  type StoreServicePointStatus,
} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {OperationsStoreCatalogManagementDisabledSurface} from '../../../app/components/OperationsStoreCatalogManagementDisabledSurface';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useStoreOperatingRuleGate} from '../../store-operating-rules/model/useStoreOperatingRuleGate';
import {
  areaTypeForPointType,
  displayExtensionValue,
  enabledStoreServicePointExtensionFields,
  hydrateStoreServicePointExtensionValues,
  serializeStoreServicePointExtensionValues,
  storeServicePointAreaTypeLabels,
  storeServicePointShapeLabels,
  storeServicePointStatusLabels,
  STORE_SERVICE_POINT_OPERATION_COLUMN_TITLE,
  titleForArea,
  pointTypeForArea,
} from '../model/storeServicePointModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';
import {AssetPreview} from '../../../app/components/AssetPreview';

type AreaEditor = {mode: 'create' | 'edit'; area?: StoreServicePointArea};
type PointEditor = {mode: 'create' | 'edit'; areaType: StoreServicePointAreaType; point?: StoreServicePoint};
type AreaFormValues = {
  name: string;
  code: string;
  areaType: StoreServicePointAreaType;
  status?: StoreServicePointStatus;
};
type PointFormValues = {
  name: string;
  code: string;
  seatCapacity?: number;
  tableShape?: StoreServicePointShape;
  reservable?: boolean | null;
  extensionValues?: Record<string, JsonValue | Dayjs | undefined>;
};
type QrFormValues = {enabled: boolean; channelRef?: string};
type QrDisplayConfiguration = Pick<StoreQrConfigurationView, 'enabled' | 'channelRef'>;
type QrReadState = {loading: boolean; failed: boolean};

function qrDisplayValue(
  value: string | null | undefined,
  configuration: QrDisplayConfiguration | undefined,
  effectiveAvailable: boolean,
  readState: QrReadState,
  size: number,
  imageTestId?: string,
) {
  if (!effectiveAvailable) return <Typography.Text type="secondary">不可用</Typography.Text>;
  if (readState.loading && !configuration) return <Typography.Text type="secondary">二维码配置加载中…</Typography.Text>;
  if (readState.failed && !configuration) return <Typography.Text type="secondary">二维码配置读取失败</Typography.Text>;
  if (!configuration) return '暂未生成二维码';
  if (!configuration.enabled) return '不显示生成结果';
  if (!configuration.channelRef) return '未选择门店渠道';
  if (!value) return '暂未生成二维码';
  return (
    <QRCode
      value={value}
      type="svg"
      size={size}
      bordered={false}
      aria-label="二维码"
      {...(imageTestId ? testId(imageTestId) : {})}
    />
  );
}

type StoreServicePointImage = {
  id: string;
  identity: string;
  fileName: string;
  status: 'READY' | 'UPLOADING' | 'FAILED';
  file?: File;
  hasPreview: boolean;
  assetRef?: string;
  bindGrant?: string;
  version?: number;
  staged: boolean;
  error?: string;
};

const PAGE_SIZE = 20;
const IMAGE_LIMITS = {maxImageCount: 1, maxImageBytes: 2 * 1024 * 1024} as const;
const statusColors: Record<StoreServicePointStatus, string> = {
  ENABLED: 'success',
  DISABLED: 'warning',
  VOIDED: 'default',
};

function emptyUuid() {
  return '' as StoreServicePoint['storeRef'];
}

function problemText(error: unknown, fallback: string) {
  const problem = operationsProblemOf(error);
  return problem.detail || fallback;
}

function queryRefetchFailed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'error' in value && (value as {error?: unknown}).error);
}

function statusTag(status: StoreServicePointStatus) {
  return <Tag color={statusColors[status]}>{storeServicePointStatusLabels[status]}</Tag>;
}

function ExtensionFormItems({definition}: {definition?: ExtensionDefinition}) {
  return (
    <>
      {enabledStoreServicePointExtensionFields(definition).map(field => {
        const locator = `store-service-point-extension-${field.key}`;
        const control =
          field.type === 'NUMBER' ? (
            <InputNumber style={{width: '100%'}} {...testId(locator)} />
          ) : field.type === 'BOOLEAN' ? (
            <Switch {...testId(locator)} />
          ) : field.type === 'DATE' ? (
            <DatePicker style={{width: '100%'}} {...testId(locator)} />
          ) : field.type === 'SELECT' ? (
            <Select
              options={field.options.map(option => ({value: option, label: option}))}
              style={{width: '100%'}}
              {...testId(locator)}
            />
          ) : (
            <Input maxLength={2000} {...testId(locator)} />
          );
        return (
          <Form.Item
            key={field.key}
            name={['extensionValues', field.key]}
            label={field.label}
            rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []}
            valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}
          >
            {control}
          </Form.Item>
        );
      })}
    </>
  );
}

function PointImageEditor({
  items,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
}: {
  items: readonly StoreServicePointImage[];
  onStageMedia: (file: File, existingId?: string) => void | Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
}) {
  return (
    <AdminImageCollectionEditor
      items={items}
      limits={IMAGE_LIMITS}
      labels={{
        title: '桌台图片',
        formatLimits: count => `${count}/1 · 单张上限 2MB`,
        loading: '图片规则加载中',
        atLimit: '已配置图片',
        upload: '上传图片',
        empty: '未配置图片',
        pendingPreview: item => (
          <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
            <Typography.Text type="secondary">{item.status === 'FAILED' ? '图片上传失败' : '待上传'}</Typography.Text>
          </span>
        ),
        renderPreview: (item, index, previewId) => (
          <AssetPreview
            assetRef={item.assetRef}
            localFile={item.file}
            alt={`${index === 0 ? '桌台主图' : '桌台图片'}预览`}
            width={96}
            height={72}
            testId={previewId}
          />
        ),
        renderStatus: item =>
          item.status === 'UPLOADING'
            ? '上传中/处理中'
            : item.status === 'FAILED'
              ? (item.error ?? '上传失败')
              : item.staged
                ? '待保存'
                : '已配置',
        positionLabel: () => '图片',
        replace: '替换',
        retry: '重试',
        moveUp: '上移',
        moveDown: '下移',
        setPrimary: '设为主图',
        remove: '移除',
      }}
      testIds={{
        root: storeServicePointTestIds.pointImageUpload,
        upload: `${storeServicePointTestIds.pointImageUpload}-upload`,
        list: `${storeServicePointTestIds.pointImageUpload}-list`,
        item: (identity, action) => `${storeServicePointTestIds.pointImageUpload}-${identity}-${action}`,
      }}
      onStageMedia={onStageMedia}
      onRemoveMedia={onRemoveMedia}
      onMoveMedia={onMoveMedia}
      onSetPrimaryMedia={() => undefined}
    />
  );
}

export function StoreServicePointPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const {token} = theme.useToken();
  const {modal} = App.useApp();
  const storeRef = queryContext.scopeRef;
  const storeWireRef = storeRef ? wireUuid(storeRef) : emptyUuid();
  const scopeReady = Boolean(storeRef);
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.EDIT_STORE_SERVICE_POINT_QR);
  const gate = useStoreOperatingRuleGate({queryContext, enabled: scopeReady, ruleKey: 'tableManagementEnabled'});
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string}>();
  const [selectedAreaRef, setSelectedAreaRef] = useState<string>();
  const [areaEditor, setAreaEditor] = useState<AreaEditor>();
  const [pointEditor, setPointEditor] = useState<PointEditor>();
  const [qrEditOpen, setQrEditOpen] = useState(false);
  const [pointProblem, setPointProblem] = useState<string>();
  const [imageItems, setImageItems] = useState<StoreServicePointImage[]>([]);
  const imageItemsRef = useRef<StoreServicePointImage[]>([]);
  const detail = useDetailDrawer<StoreServicePoint>();
  const [areaForm] = Form.useForm<AreaFormValues>();
  const [pointForm] = Form.useForm<PointFormValues>();
  const [qrForm] = Form.useForm<QrFormValues>();

  const areaCursor = useCursorStack({resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}`});
  const areasRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePointAreas(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {query: {cursor: areaCursor.cursor, pageSize: PAGE_SIZE}},
      ),
    [areaCursor.cursor, queryContext.groupWorkspaceKey, storeWireRef],
  );
  const areasQuery = operationsRtk.useGetOperationsStoreServicePointAreasQuery(areasRequest, {
    skip: !gate.isEnabled || !scopeReady,
  });
  const areas = useMemo(() => areasQuery.currentData?.items ?? [], [areasQuery.currentData]);
  const selectedArea = areas.find(area => area.areaRef === selectedAreaRef);
  const pointCursor = useCursorStack({
    resetKey: `${queryContext.groupWorkspaceKey}:${storeRef ?? ''}:${selectedAreaRef ?? ''}`,
  });
  const pointsRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePoints(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeWireRef,
          areaRef: selectedAreaRef ? wireUuid(selectedAreaRef) : emptyUuid(),
        },
        {query: {cursor: pointCursor.cursor, pageSize: PAGE_SIZE}},
      ),
    [pointCursor.cursor, queryContext.groupWorkspaceKey, selectedAreaRef, storeWireRef],
  );
  const pointsQuery = operationsRtk.useGetOperationsStoreServicePointsQuery(pointsRequest, {
    skip: !gate.isEnabled || !scopeReady || !selectedAreaRef,
  });
  const points = pointsQuery.currentData?.items ?? [];

  const qrRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreQrConfiguration(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {},
      ),
    [queryContext.groupWorkspaceKey, storeWireRef],
  );
  const qrQuery = operationsRtk.useGetOperationsStoreQrConfigurationQuery(qrRequest, {
    skip: !gate.isEnabled || !scopeReady,
  });
  const qrConfiguration = qrQuery.currentData;
  const refetchAreas = areasQuery.refetch;
  const refetchPoints = pointsQuery.refetch;
  const refetchQr = qrQuery.refetch;

  const extensionDefinitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationBusinessEntityExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, entityType: 'SERVICE_POINT'}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const extensionDefinitionQuery = operationsRtk.useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery(
    extensionDefinitionRequest,
    {
      skip: !gate.isEnabled || !scopeReady,
    },
  );
  const extensionDefinition = extensionDefinitionQuery.currentData;

  const candidateRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreQrChannelCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef},
        {},
      ),
    [queryContext.groupWorkspaceKey, storeWireRef],
  );
  const candidateQuery = operationsRtk.useGetOperationsStoreQrChannelCandidatesQuery(candidateRequest, {
    skip: !qrEditOpen || !gate.isEnabled || !scopeReady,
  });

  const detailRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsStoreServicePoint(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeRef: storeWireRef,
          servicePointRef: detail.target ? wireUuid(detail.target.pointRef) : emptyUuid(),
        },
        {},
      ),
    [detail.target, queryContext.groupWorkspaceKey, storeWireRef],
  );
  const detailQuery = operationsRtk.useGetOperationsStoreServicePointQuery(detailRequest, {
    skip: !detail.isOpen || !detail.target || !gate.isEnabled || !scopeReady,
  });
  const detailValue =
    detailQuery.currentData && detail.target && detailQuery.currentData.pointRef === detail.target.pointRef
      ? detailQuery.currentData
      : detail.target;

  const areaLifecycle = useDrawerFormLifecycle({
    open: Boolean(areaEditor),
    onOpenChange: open => {
      if (!open) setAreaEditor(undefined);
    },
    dirtyMessage: '区域资料尚未保存。',
    idempotencyKey: true,
    diagnosticOperationId:
      areaEditor?.mode === 'create'
        ? OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointArea
        : OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePointArea,
  });
  const pointLifecycle = useDrawerFormLifecycle({
    open: Boolean(pointEditor),
    onOpenChange: open => {
      if (!open) setPointEditor(undefined);
    },
    dirtyMessage: '桌台或扫码点资料尚未保存。',
    idempotencyKey: true,
    diagnosticOperationId:
      pointEditor?.mode === 'create'
        ? OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePoint
        : OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePoint,
  });
  const qrLifecycle = useDrawerFormLifecycle({
    open: qrEditOpen,
    onOpenChange: setQrEditOpen,
    dirtyMessage: '二维码配置尚未保存。',
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreQrConfiguration,
  });
  const resetAreaLifecycle = areaLifecycle.reset;
  const resetPointLifecycle = pointLifecycle.reset;
  const resetQrLifecycle = qrLifecycle.reset;

  useEffect(() => {
    if (!scopeReady || !gate.isEnabled) {
      setSelectedAreaRef(undefined);
      return;
    }
    if (selectedAreaRef && areas.some(area => area.areaRef === selectedAreaRef)) return;
    setSelectedAreaRef(undefined);
  }, [areas, gate.isEnabled, scopeReady, selectedAreaRef]);

  useEffect(() => {
    if (!areaEditor) {
      areaForm.resetFields();
      return;
    }
    areaForm.setFieldsValue({
      name: areaEditor.area?.name ?? '',
      code: areaEditor.area?.code ?? '',
      areaType: areaEditor.area?.areaType ?? 'TABLE_AREA',
      status: areaEditor.area?.status,
    });
    resetAreaLifecycle();
  }, [areaEditor, areaForm, resetAreaLifecycle]);

  useEffect(() => {
    if (!pointEditor) {
      pointForm.resetFields();
      return;
    }
    const point = pointEditor.point;
    pointForm.setFieldsValue({
      name: point?.name ?? '',
      code: point?.code ?? '',
      seatCapacity: point?.seatCapacity ?? undefined,
      tableShape: point?.tableShape ?? undefined,
      reservable: point?.reservable ?? undefined,
      extensionValues: hydrateStoreServicePointExtensionValues(extensionDefinition, point?.extensionValues),
    });
    setImageItems(
      point?.imageAssetRef
        ? [
            {
              id: String(point.imageAssetRef),
              identity: String(point.imageAssetRef),
              assetRef: String(point.imageAssetRef),
              fileName: '桌台图片',
              status: 'READY',
              hasPreview: true,
              staged: false,
            },
          ]
        : [],
    );
    resetPointLifecycle();
    setPointProblem(undefined);
  }, [extensionDefinition, pointEditor, pointForm, resetPointLifecycle]);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(() => {
    if (!qrEditOpen || !qrConfiguration) return;
    qrForm.setFieldsValue({
      enabled: qrConfiguration.enabled,
      channelRef: qrConfiguration.channelRef ? String(qrConfiguration.channelRef) : undefined,
    });
    resetQrLifecycle();
  }, [qrConfiguration, qrEditOpen, qrForm, resetQrLifecycle]);

  const readBack = useCallback(
    async (target: 'areas' | 'area-and-points' | 'points' | 'qr') => {
      const refetches: Array<Promise<unknown>> =
        target === 'qr' ? [refetchQr()] : target === 'points' ? [refetchPoints()] : [refetchAreas()];
      if (target === 'area-and-points' && selectedAreaRef) refetches.push(refetchPoints());
      const results = await Promise.all(refetches);
      if (results.some(queryRefetchFailed)) throw new Error('STORE_SERVICE_POINT_READBACK_FAILED');
    },
    [refetchAreas, refetchPoints, refetchQr, selectedAreaRef],
  );

  const runAreaMutation = useCallback(
    async (operation: 'create' | 'update', values: AreaFormValues) => {
      if (!storeRef || !areaEditor) return;
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        ...(areaEditor.area ? {areaRef: wireUuid(areaEditor.area.areaRef)} : {}),
      };
      const body =
        operation === 'create'
          ? {name: values.name.trim(), code: values.code.trim(), areaType: values.areaType}
          : {
              name: values.name.trim(),
              code: values.code.trim(),
              areaType: values.areaType,
              status: values.status ?? 'ENABLED',
              expectedVersion: areaEditor.area?.version ?? 0,
            };
      const operationId =
        operation === 'create'
          ? OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointArea
          : OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePointArea;
      const key = await createContentIdempotencyKey(operationId, {path, body});
      if (operation === 'create') {
        await operationsClient.postOperationsStoreServicePointArea(path as never, {
          body: body as never,
          headers: {'Idempotency-Key': key},
        });
      } else {
        await operationsClient.patchOperationsStoreServicePointArea(path as never, {
          body: body as never,
          headers: {'Idempotency-Key': key},
        });
      }
      await readBack('area-and-points');
      areaLifecycle.setDirty(false);
      areaLifecycle.closeAfterSuccess();
      setFeedback({type: 'success', message: operation === 'create' ? '区域已创建。' : '区域已保存。'});
    },
    [areaEditor, areaLifecycle, queryContext.groupWorkspaceKey, readBack, storeRef, storeWireRef],
  );

  const changeAreaStatus = useCallback(
    async (area: StoreServicePointArea, status: StoreServicePointStatus) => {
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        areaRef: wireUuid(area.areaRef),
      };
      const body = {status, expectedVersion: area.version};
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointAreaStatus,
        {
          path,
          body,
        },
      );
      await operationsClient.postOperationsStoreServicePointAreaStatus(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
      await readBack('area-and-points');
      setFeedback({
        type: 'success',
        message: status === 'VOIDED' ? '区域已作废。' : `区域已${storeServicePointStatusLabels[status]}。`,
      });
    },
    [queryContext.groupWorkspaceKey, readBack, storeWireRef],
  );

  const moveArea = useCallback(
    async (area: StoreServicePointArea, direction: 'UP' | 'DOWN') => {
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        areaRef: wireUuid(area.areaRef),
      };
      const body = {direction, expectedVersion: area.version};
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointAreaOrder,
        {
          path,
          body,
        },
      );
      await operationsClient.postOperationsStoreServicePointAreaOrder(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
      await readBack('areas');
      setFeedback({type: 'success', message: '区域顺序已更新。'});
    },
    [queryContext.groupWorkspaceKey, readBack, storeWireRef],
  );

  const releaseStagedImages = useCallback(async () => {
    const staged = imageItemsRef.current.filter(item => item.staged && item.assetRef && item.version !== undefined);
    for (const item of staged) {
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
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
        setPointProblem(problemText(error, '图片资产释放未完成，请重试关闭。'));
      }
    }
  }, [queryContext.groupWorkspaceKey, storeWireRef]);

  const stagePointImage = useCallback(
    async (file: File, existingId?: string) => {
      if (!pointEditor || pointEditor.areaType !== 'TABLE_AREA') return;
      if (file.size > IMAGE_LIMITS.maxImageBytes) {
        setPointProblem('单张图片不能超过 2MB。');
        return;
      }
      const pendingId = existingId ?? `pending-${Date.now()}`;
      const placeholder: StoreServicePointImage = {
        id: pendingId,
        identity: pendingId,
        fileName: file.name,
        status: 'UPLOADING',
        file,
        hasPreview: true,
        staged: true,
      };
      setImageItems([placeholder]);
      setPointProblem(undefined);
      try {
        const contentDigest = await digestFileContent(file);
        const path = {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef};
        const body = {
          fileName: file.name,
          mediaType: file.type || 'application/octet-stream',
          contentDigest,
          content: file,
        };
        const key = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.stageStoreServicePointImage, {
          path,
          fileName: file.name,
          contentDigest,
        });
        const response = await operationsClient.stageStoreServicePointImage(path, {
          body,
          headers: {'Idempotency-Key': key},
        });
        setImageItems(current =>
          current.map(item =>
            item.id === pendingId
              ? {
                  ...item,
                  id: String(response.assetRef),
                  identity: String(response.assetRef),
                  assetRef: String(response.assetRef),
                  bindGrant: response.bindGrant,
                  version: response.version,
                  status: 'READY',
                }
              : item,
          ),
        );
      } catch (error) {
        setImageItems(current =>
          current.map(item =>
            item.id === pendingId
              ? {...item, status: 'FAILED', staged: false, error: problemText(error, '图片上传失败，请重试。')}
              : item,
          ),
        );
        setPointProblem(problemText(error, '图片上传失败，请重试。'));
      }
    },
    [pointEditor, queryContext.groupWorkspaceKey, storeWireRef],
  );

  const submitPoint = useCallback(
    async (values: PointFormValues) => {
      if (!pointEditor || !storeRef || !selectedAreaRef || !extensionDefinition) return;
      const image = imageItems[0];
      const pointType = pointTypeForArea(pointEditor.areaType);
      const body = {
        name: values.name.trim(),
        code: values.code.trim(),
        pointType,
        seatCapacity: pointType === 'TABLE' ? (values.seatCapacity ?? null) : null,
        tableShape: pointType === 'TABLE' ? (values.tableShape ?? null) : null,
        reservable: pointType === 'TABLE' ? (values.reservable ?? null) : null,
        imageAssetRef: pointType === 'TABLE' && image?.assetRef ? wireUuid(image.assetRef) : null,
        imageBindGrant: pointType === 'TABLE' ? (image?.bindGrant ?? null) : null,
        extensionValues: serializeStoreServicePointExtensionValues(extensionDefinition, values.extensionValues),
        extensionRuleRevision: extensionDefinition.revision,
        ...(pointEditor.point ? {status: pointEditor.point.status, expectedVersion: pointEditor.point.version} : {}),
      };
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        ...(pointEditor.point
          ? {servicePointRef: wireUuid(pointEditor.point.pointRef)}
          : {areaRef: wireUuid(selectedAreaRef)}),
      };
      const operationId = pointEditor.point
        ? OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreServicePoint
        : OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePoint;
      const key = await createContentIdempotencyKey(operationId, {path, body});
      if (pointEditor.point) {
        await operationsClient.patchOperationsStoreServicePoint(path as never, {
          body: body as never,
          headers: {'Idempotency-Key': key},
        });
      } else {
        await operationsClient.postOperationsStoreServicePoint(path as never, {
          body,
          headers: {'Idempotency-Key': key},
        });
      }
      await readBack('points');
      setImageItems([]);
      setPointProblem(undefined);
      pointLifecycle.setDirty(false);
      pointLifecycle.closeAfterSuccess();
      setFeedback({
        type: 'success',
        message: pointEditor.point
          ? `${titleForArea(pointEditor.areaType)}已保存。`
          : `${titleForArea(pointEditor.areaType)}已创建。`,
      });
    },
    [
      extensionDefinition,
      imageItems,
      pointEditor,
      pointLifecycle,
      queryContext.groupWorkspaceKey,
      readBack,
      selectedAreaRef,
      storeRef,
      storeWireRef,
    ],
  );

  const changePointStatus = useCallback(
    async (point: StoreServicePoint, status: StoreServicePointStatus) => {
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        servicePointRef: wireUuid(point.pointRef),
      };
      const body = {status, expectedVersion: point.version};
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointStatus,
        {
          path,
          body,
        },
      );
      await operationsClient.postOperationsStoreServicePointStatus(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
      await readBack('points');
      setFeedback({
        type: 'success',
        message:
          status === 'VOIDED'
            ? `${titleForArea(selectedArea?.areaType)}已作废。`
            : `${titleForArea(selectedArea?.areaType)}已${storeServicePointStatusLabels[status]}。`,
      });
    },
    [queryContext.groupWorkspaceKey, readBack, selectedArea?.areaType, storeWireRef],
  );

  const movePoint = useCallback(
    async (point: StoreServicePoint, direction: 'UP' | 'DOWN') => {
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: storeWireRef,
        servicePointRef: wireUuid(point.pointRef),
      };
      const body = {direction, expectedVersion: point.version};
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreServicePointOrder,
        {
          path,
          body,
        },
      );
      await operationsClient.postOperationsStoreServicePointOrder(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
      await readBack('points');
      setFeedback({type: 'success', message: `${titleForArea(selectedArea?.areaType)}顺序已更新。`});
    },
    [queryContext.groupWorkspaceKey, readBack, selectedArea?.areaType, storeWireRef],
  );

  const changeQrConfiguration = useCallback(
    async (values: QrFormValues) => {
      if (!qrConfiguration) return;
      const path = {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: storeWireRef};
      const body = {
        enabled: Boolean(values.enabled),
        channelRef: values.channelRef ? wireUuid(values.channelRef) : null,
        expectedVersion: qrConfiguration.version,
      };
      const key = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.patchOperationsStoreQrConfiguration,
        {
          path,
          body,
        },
      );
      await operationsClient.patchOperationsStoreQrConfiguration(path, {
        body,
        headers: {'Idempotency-Key': key},
      });
      await readBack('qr');
      qrLifecycle.setDirty(false);
      qrLifecycle.closeAfterSuccess();
      setFeedback({type: 'success', message: '二维码配置已保存。'});
    },
    [qrConfiguration, qrLifecycle, queryContext.groupWorkspaceKey, readBack, storeWireRef],
  );

  const askStatusChange = useCallback(
    (target: 'area' | 'point', row: StoreServicePointArea | StoreServicePoint, status: StoreServicePointStatus) => {
      const label = target === 'area' ? '区域' : titleForArea(selectedArea?.areaType);
      modal.confirm({
        title: status === 'VOIDED' ? `确认作废${label}？` : `确认${status === 'ENABLED' ? '启用' : '停用'}${label}？`,
        content: status === 'VOIDED' ? `作废后将保留${label}历史资料，且不再参与当前列表。` : undefined,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          try {
            if (target === 'area') await changeAreaStatus(row as StoreServicePointArea, status);
            else await changePointStatus(row as StoreServicePoint, status);
          } catch (error) {
            setFeedback({type: 'error', message: problemText(error, `${label}状态更新失败，请重试。`)});
          }
        },
      });
    },
    [changeAreaStatus, changePointStatus, modal, selectedArea?.areaType],
  );

  const areaMenu = useCallback(
    (area: StoreServicePointArea): MenuProps => ({
      items: [
        {
          key: 'edit',
          label: '编辑区域',
          disabled: !canEdit,
          ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'edit')),
        },
        {
          key: 'up',
          label: '上移',
          disabled: !canEdit || !area.canMoveUp,
          ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'up')),
        },
        {
          key: 'down',
          label: '下移',
          disabled: !canEdit || !area.canMoveDown,
          ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'down')),
        },
        {type: 'divider'},
        area.status !== 'VOIDED'
          ? {
              key: 'status',
              label: area.status === 'ENABLED' ? '停用' : '启用',
              disabled: !canEdit,
              ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'status')),
            }
          : null,
        area.status !== 'VOIDED'
          ? {
              key: 'void',
              label: '作废区域',
              danger: true,
              disabled: !canEdit,
              ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'void')),
            }
          : null,
      ].filter(Boolean) as NonNullable<MenuProps['items']>,
      onClick: event => {
        if (event.key === 'edit') setAreaEditor({mode: 'edit', area});
        if (event.key === 'up' || event.key === 'down')
          void moveArea(area, event.key === 'up' ? 'UP' : 'DOWN').catch(error => {
            setFeedback({type: 'error', message: problemText(error, '区域顺序更新失败，请重试。')});
          });
        if (event.key === 'status') askStatusChange('area', area, area.status === 'ENABLED' ? 'DISABLED' : 'ENABLED');
        if (event.key === 'void') askStatusChange('area', area, 'VOIDED');
      },
    }),
    [askStatusChange, canEdit, moveArea],
  );

  const pointMenu = useCallback(
    (point: StoreServicePoint): MenuProps => ({
      items: [
        {
          key: 'edit',
          label: `编辑${titleForArea(selectedArea?.areaType)}`,
          disabled: !canEdit,
          ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'edit')),
        },
        {
          key: 'up',
          label: '上移',
          disabled: !canEdit || !point.canMoveUp,
          ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'up')),
        },
        {
          key: 'down',
          label: '下移',
          disabled: !canEdit || !point.canMoveDown,
          ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'down')),
        },
        {type: 'divider'},
        point.status !== 'VOIDED'
          ? {
              key: 'status',
              label: point.status === 'ENABLED' ? '停用' : '启用',
              disabled: !canEdit,
              ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'status')),
            }
          : null,
        point.status !== 'VOIDED'
          ? {
              key: 'void',
              label: `作废${titleForArea(selectedArea?.areaType)}`,
              danger: true,
              disabled: !canEdit,
              ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'void')),
            }
          : null,
      ].filter(Boolean) as NonNullable<MenuProps['items']>,
      onClick: event => {
        if (event.key === 'edit' && selectedArea)
          setPointEditor({mode: 'edit', areaType: selectedArea.areaType, point});
        if (event.key === 'up' || event.key === 'down')
          void movePoint(point, event.key === 'up' ? 'UP' : 'DOWN').catch(error => {
            setFeedback({
              type: 'error',
              message: problemText(error, `${titleForArea(selectedArea?.areaType)}顺序更新失败，请重试。`),
            });
          });
        if (event.key === 'status')
          askStatusChange('point', point, point.status === 'ENABLED' ? 'DISABLED' : 'ENABLED');
        if (event.key === 'void') askStatusChange('point', point, 'VOIDED');
      },
    }),
    [askStatusChange, canEdit, movePoint, selectedArea],
  );

  const pointColumns: TableColumnsType<StoreServicePoint> = useMemo(
    () =>
      [
        {
          title: `${titleForArea(selectedArea?.areaType)}名称`,
          dataIndex: 'name',
          key: 'name',
          render: (value: string, row) => (
            <Button
              type="link"
              onClick={() => detail.open(row)}
              style={{paddingInline: 0}}
              {...testId(storeServicePointTestIds.pointRow(row.pointRef))}
            >
              {value}
            </Button>
          ),
        },
        {title: '编码', dataIndex: 'code', key: 'code'},
        ...(selectedArea?.areaType === 'TABLE_AREA'
          ? [
              {
                title: '容纳人数',
                dataIndex: 'seatCapacity',
                key: 'seatCapacity',
                render: (value: number | null) => value ?? '—',
              },
              {
                title: '形态',
                dataIndex: 'tableShape',
                key: 'tableShape',
                render: (value: StoreServicePointShape | null) => (value ? storeServicePointShapeLabels[value] : '—'),
              },
            ]
          : []),
        {
          title: '二维码',
          dataIndex: 'qrUrl',
          key: 'qrUrl',
          render: (value: string | null, row) =>
            qrDisplayValue(
              value,
              qrConfiguration,
              row.effectiveAvailable,
              {loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)},
              72,
              storeServicePointTestIds.qrResultImage(row.pointRef),
            ),
        },
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          render: (value: StoreServicePointStatus, row) => (
            <Space size={4} wrap>
              {statusTag(value)}
              {!row.effectiveAvailable && <Tag>不可用</Tag>}
            </Space>
          ),
        },
        {
          title: STORE_SERVICE_POINT_OPERATION_COLUMN_TITLE,
          key: 'actions',
          width: 72,
          render: (_value, row) => (
            <Dropdown menu={pointMenu(row)} trigger={['click']}>
              <Button
                type="text"
                icon={<MoreOutlined />}
                aria-label={`更多${titleForArea(selectedArea?.areaType)}操作`}
                {...testId(storeServicePointTestIds.pointMenu(row.pointRef))}
              />
            </Dropdown>
          ),
        },
      ] as TableColumnsType<StoreServicePoint>,
    [detail, pointMenu, qrConfiguration, qrQuery.error, qrQuery.isFetching, selectedArea?.areaType],
  );

  const qrOptions = useMemo(() => {
    const qrCandidates: StoreQrChannelCandidate[] = candidateQuery.currentData?.items ?? [];
    const options = qrCandidates.map(candidate => ({
      value: String(candidate.channelRef),
      label: `${candidate.channelName}${candidate.channelCode ? `（${candidate.channelCode}）` : ''} · 模板：${candidate.templateName}`,
      'data-testid': storeServicePointTestIds.qrChannelOption(String(candidate.channelRef)),
    }));
    if (qrConfiguration?.channelRef && !options.some(option => option.value === String(qrConfiguration.channelRef))) {
      options.unshift({
        value: String(qrConfiguration.channelRef),
        label: `${qrConfiguration.channelName ?? '当前已选渠道'}（当前配置）`,
        'data-testid': storeServicePointTestIds.qrChannelOption(String(qrConfiguration.channelRef)),
      });
    }
    return options;
  }, [candidateQuery.currentData?.items, qrConfiguration]);

  const renderExtensionDetails = (point: StoreServicePoint) => (
    <Descriptions {...adminDetailDescriptionsProps} column={1}>
      {enabledStoreServicePointExtensionFields(extensionDefinition).map(field => (
        <Descriptions.Item key={field.key} label={field.label}>
          {displayExtensionValue(point.extensionValues[field.key])}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );

  const pageFeedback = feedback && (
    <Alert
      type={feedback.type}
      showIcon
      closable
      title={feedback.message}
      onClose={() => setFeedback(undefined)}
      {...testId(storeServicePointTestIds.feedback)}
    />
  );

  const content = !scopeReady ? (
    <Alert type="info" showIcon title="请先选择门店数据节点。" />
  ) : gate.state === 'SCOPE_MISSING' ||
    gate.state === 'LOADING' ||
    gate.state === 'FAILED' ||
    gate.state === 'DISABLED' ? (
    gate.state === 'SCOPE_MISSING' ? (
      <Alert type="info" showIcon title="请先选择门店数据节点。" />
    ) : (
      <div {...testId(storeServicePointTestIds.operatingRuleGate)}>
        <OperationsStoreCatalogManagementDisabledSurface
          state={gate.state as 'LOADING' | 'FAILED' | 'DISABLED'}
          onRetry={gate.retry}
        />
      </div>
    )
  ) : (
    <Space direction="vertical" size={16} style={{display: 'flex'}}>
      <Card
        size="small"
        title="二维码配置"
        extra={
          canEdit && qrConfiguration && !qrQuery.isFetching && !qrQuery.error ? (
            <Button onClick={() => setQrEditOpen(true)} {...testId(storeServicePointTestIds.qrEdit)}>
              编辑
            </Button>
          ) : undefined
        }
        {...testId(storeServicePointTestIds.qrConfig)}
      >
        {qrQuery.isFetching && !qrConfiguration ? (
          <Skeleton active paragraph={{rows: 2}} />
        ) : qrQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="二维码配置读取失败"
            description={problemText(qrQuery.error, '请重试。')}
            action={<Button onClick={() => void qrQuery.refetch()}>重试</Button>}
          />
        ) : qrConfiguration ? (
          <Descriptions {...adminDetailDescriptionsProps} column={{xs: 1, sm: 2}}>
            <Descriptions.Item label="是否开启二维码下单">{qrConfiguration.enabled ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="门店渠道">{qrConfiguration.channelName || '未选择'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>
      <div style={{display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 16}}>
        <Card
          size="small"
          title="区域"
          extra={
            canEdit && areasQuery.currentData && !areasQuery.isFetching && !areasQuery.error ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAreaEditor({mode: 'create'})}
                {...testId(storeServicePointTestIds.areaCreate)}
              >
                新建区域
              </Button>
            ) : undefined
          }
          {...testId(storeServicePointTestIds.areaList)}
        >
          {areasQuery.isFetching && !areasQuery.currentData ? (
            <Spin tip="区域加载中…" />
          ) : areasQuery.error ? (
            <Alert
              type="error"
              showIcon
              title="区域列表读取失败"
              action={<Button onClick={() => void areasQuery.refetch()}>重试</Button>}
            />
          ) : areas.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无区域" />
          ) : (
            <Space direction="vertical" size={4} style={{display: 'flex'}}>
              {areas.map(area => {
                const active = area.areaRef === selectedAreaRef;
                return (
                  <div key={area.areaRef} style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 0}}>
                    <Button
                      type="text"
                      onClick={() => setSelectedAreaRef(area.areaRef)}
                      aria-current={active ? 'true' : undefined}
                      style={{
                        appearance: 'none',
                        width: '100%',
                        minHeight: 40,
                        padding: '8px 10px',
                        border: `1px solid ${active ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                        borderInlineStart: `3px solid ${active ? token.colorPrimary : 'transparent'}`,
                        borderRadius: token.borderRadius,
                        background: active ? token.colorPrimaryBg : token.colorBgContainer,
                        color: token.colorText,
                        cursor: 'pointer',
                        font: 'inherit',
                        flex: '1 1 auto',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                      }}
                      {...testId(storeServicePointTestIds.areaRow(area.areaRef))}
                    >
                      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {area.name}
                      </span>
                      <Typography.Text type="secondary">
                        {storeServicePointAreaTypeLabels[area.areaType]}
                      </Typography.Text>
                    </Button>
                    <Dropdown menu={areaMenu(area)} trigger={['click']}>
                      <Button
                        type="text"
                        icon={<MoreOutlined />}
                        aria-label="更多区域操作"
                        {...testId(storeServicePointTestIds.areaMenu(area.areaRef))}
                      />
                    </Dropdown>
                  </div>
                );
              })}
              <CursorPagination
                state={areaCursor}
                nextCursor={areasQuery.currentData?.nextCursor ?? undefined}
                testIdPrefix="store-service-point-area-pagination"
              />
            </Space>
          )}
        </Card>
        <Card
          size="small"
          title={selectedArea ? titleForArea(selectedArea.areaType) : '请选择区域'}
          extra={
            selectedArea &&
            selectedArea.status === 'ENABLED' &&
            canEdit &&
            !areasQuery.isFetching &&
            !areasQuery.error ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setPointEditor({mode: 'create', areaType: selectedArea.areaType})}
                {...testId(storeServicePointTestIds.pointCreate)}
              >
                新建{titleForArea(selectedArea.areaType)}
              </Button>
            ) : null
          }
          {...testId(storeServicePointTestIds.pointList)}
        >
          {!selectedArea ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择区域" />
          ) : (
            <>
              {pointsQuery.error && (
                <Alert
                  type="error"
                  showIcon
                  title={`${titleForArea(selectedArea.areaType)}列表读取失败`}
                  action={<Button onClick={() => void pointsQuery.refetch()}>重试</Button>}
                />
              )}
              <Table<StoreServicePoint>
                rowKey="pointRef"
                size="small"
                pagination={false}
                {...adminListState({
                  loading: pointsQuery.isFetching,
                  failed: Boolean(pointsQuery.error),
                  emptyText: `暂无${titleForArea(selectedArea.areaType)}`,
                  testIdPrefix: storeServicePointTestIds.pointList,
                })}
                columns={pointColumns}
                dataSource={pointsQuery.error ? [] : points}
              />
              <CursorPagination
                state={pointCursor}
                nextCursor={pointsQuery.currentData?.nextCursor ?? undefined}
                testIdPrefix="store-service-point-point-pagination"
                style={{marginTop: 12}}
              />
            </>
          )}
        </Card>
      </div>
    </Space>
  );

  return (
    <div {...testId(storeServicePointTestIds.page)} data-scope-ref={queryContext.scopeRef}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {pageFeedback}
        {content}
      </Space>

      <Drawer
        open={Boolean(areaEditor)}
        title={areaEditor?.mode === 'create' ? '新建区域' : '编辑区域'}
        onClose={areaLifecycle.requestClose}
        afterOpenChange={areaLifecycle.afterOpenChange}
        destroyOnHidden
        maskClosable={!areaLifecycle.submitting}
        keyboard={!areaLifecycle.submitting}
        closable={!areaLifecycle.submitting}
        {...adminDrawerSurfaceProps}
        {...testId(storeServicePointTestIds.areaDrawer)}
        footer={
          <Space>
            <Button
              onClick={areaLifecycle.requestClose}
              disabled={areaLifecycle.submitting}
              {...testId(storeServicePointTestIds.areaCancel)}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={areaLifecycle.submitting}
              onClick={() => areaForm.submit()}
              {...testId(storeServicePointTestIds.areaSave)}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={areaForm}
          layout="vertical"
          disabled={areaLifecycle.submitting}
          onFinish={values => {
            areaLifecycle.setSubmitting(true);
            void runAreaMutation(areaEditor?.mode === 'edit' ? 'update' : 'create', values)
              .catch(error => {
                setFeedback({type: 'error', message: problemText(error, '区域保存失败，请重试。')});
              })
              .finally(() => areaLifecycle.setSubmitting(false));
          }}
          onValuesChange={() => {
            areaLifecycle.setDirty(true);
            areaLifecycle.markBusinessIntentChanged();
          }}
        >
          <Form.Item
            name="name"
            label="区域名称"
            rules={[{required: true, whitespace: true, message: '请输入区域名称'}]}
          >
            <Input maxLength={120} {...testId(storeServicePointTestIds.areaName)} />
          </Form.Item>
          <Form.Item
            name="code"
            label="区域编码"
            rules={[{required: true, whitespace: true, message: '请输入区域编码'}]}
          >
            <Input maxLength={64} {...testId(storeServicePointTestIds.areaCode)} />
          </Form.Item>
          <Form.Item name="areaType" label="区域类型" rules={[{required: true, message: '请选择区域类型'}]}>
            <Select
              options={Object.entries(storeServicePointAreaTypeLabels).map(([value, label]) => ({value, label}))}
              {...testId(storeServicePointTestIds.areaType)}
            />
          </Form.Item>
          {areaEditor?.mode === 'edit' && (
            <Form.Item name="status" label="状态">
              <Select
                options={Object.entries(storeServicePointStatusLabels).map(([value, label]) => ({value, label}))}
                {...testId(storeServicePointTestIds.areaStatus)}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      <Drawer
        open={Boolean(pointEditor)}
        title={
          pointEditor
            ? pointEditor.mode === 'create'
              ? `新建${titleForArea(pointEditor.areaType)}`
              : `编辑${titleForArea(pointEditor.areaType)}资料`
            : '编辑'
        }
        onClose={pointLifecycle.requestClose}
        afterOpenChange={visible => {
          pointLifecycle.afterOpenChange(visible);
          if (!visible) void releaseStagedImages();
        }}
        destroyOnHidden
        maskClosable={!pointLifecycle.submitting}
        keyboard={!pointLifecycle.submitting}
        closable={!pointLifecycle.submitting}
        {...adminWideDrawerSurfaceProps}
        {...testId(storeServicePointTestIds.pointDrawer(pointEditor?.areaType === 'TABLE_AREA' ? 'table' : 'scan'))}
        footer={
          <Space>
            <Button
              onClick={pointLifecycle.requestClose}
              disabled={pointLifecycle.submitting}
              {...testId(storeServicePointTestIds.pointCancel)}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={pointLifecycle.submitting}
              disabled={!extensionDefinition || Boolean(extensionDefinitionQuery.error)}
              onClick={() => pointForm.submit()}
              {...testId(storeServicePointTestIds.pointSave)}
            >
              保存
            </Button>
          </Space>
        }
      >
        {pointProblem && (
          <Alert type="error" showIcon title="保存未完成" description={pointProblem} style={{marginBottom: 16}} />
        )}
        {extensionDefinitionQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="字段配置读取失败"
            description="暂时无法获取桌台与扫码点字段配置，请重试。"
            action={<Button onClick={() => void extensionDefinitionQuery.refetch()}>重试</Button>}
          />
        ) : extensionDefinitionQuery.isFetching && !extensionDefinition ? (
          <Spin tip="字段配置加载中…" />
        ) : (
          <Form
            form={pointForm}
            layout="vertical"
            disabled={pointLifecycle.submitting}
            onFinish={values => {
              pointLifecycle.setSubmitting(true);
              void submitPoint(values)
                .catch(error => setPointProblem(problemText(error, '保存失败，请重试。')))
                .finally(() => pointLifecycle.setSubmitting(false));
            }}
            onValuesChange={() => {
              pointLifecycle.setDirty(true);
              pointLifecycle.markBusinessIntentChanged();
            }}
          >
            <Form.Item
              name="name"
              label={`${pointEditor?.areaType === 'TABLE_AREA' ? '桌台' : '扫码点'}名称`}
              rules={[{required: true, whitespace: true, message: '请输入名称'}]}
            >
              <Input maxLength={120} {...testId(storeServicePointTestIds.pointName)} />
            </Form.Item>
            <Form.Item name="code" label="编码" rules={[{required: true, whitespace: true, message: '请输入编码'}]}>
              <Input maxLength={64} {...testId(storeServicePointTestIds.pointCode)} />
            </Form.Item>
            {pointEditor?.areaType === 'TABLE_AREA' && (
              <>
                <Form.Item
                  name="seatCapacity"
                  label="容纳人数"
                  rules={[{type: 'number', min: 1, message: '请输入正整数'}]}
                >
                  <InputNumber
                    min={1}
                    precision={0}
                    style={{width: '100%'}}
                    {...testId(storeServicePointTestIds.pointCapacity)}
                  />
                </Form.Item>
                <Form.Item name="tableShape" label="形态">
                  <Select
                    options={Object.entries(storeServicePointShapeLabels).map(([value, label]) => ({value, label}))}
                    {...testId(storeServicePointTestIds.pointShape)}
                  />
                </Form.Item>
                <Form.Item name="reservable" label="是否可预约">
                  <Select
                    allowClear
                    placeholder="未设置"
                    options={[
                      {value: true, label: '是'},
                      {value: false, label: '否'},
                    ]}
                    {...testId(storeServicePointTestIds.pointReservable)}
                  />
                </Form.Item>
                <PointImageEditor
                  items={imageItems}
                  onStageMedia={stagePointImage}
                  onRemoveMedia={async id => {
                    const item = imageItems.find(current => current.id === id);
                    if (item?.staged && item.assetRef && item.version !== undefined) {
                      imageItemsRef.current = [item];
                      await releaseStagedImages();
                    }
                    setImageItems([]);
                    pointLifecycle.setDirty(true);
                    pointLifecycle.markBusinessIntentChanged();
                  }}
                  onMoveMedia={() => undefined}
                />
              </>
            )}
            <div style={{marginTop: 16}} {...testId(storeServicePointTestIds.pointExtension)}>
              <ExtensionFormItems definition={extensionDefinition} />
            </div>
          </Form>
        )}
      </Drawer>

      <Drawer
        open={detail.isOpen}
        title={
          detailValue ? `${titleForArea(areaTypeForPointType(detailValue.pointType))}详情：${detailValue.name}` : '详情'
        }
        onClose={detail.close}
        {...adminDrawerSurfaceProps}
        {...testId(storeServicePointTestIds.detailDrawer)}
        extra={
          detailValue && canEdit ? (
            <Button
              onClick={() => {
                detail.close();
                setPointEditor({
                  mode: 'edit',
                  areaType: areaTypeForPointType(detailValue.pointType),
                  point: detailValue,
                });
              }}
              {...testId(storeServicePointTestIds.detailAction)}
            >
              编辑
            </Button>
          ) : undefined
        }
      >
        {detailQuery.isFetching && !detailValue ? <Spin tip="详情加载中…" /> : null}
        {detailQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="详情读取失败"
            description={problemText(detailQuery.error, '请重试。')}
            action={<Button onClick={() => void detailQuery.refetch()}>重试</Button>}
          />
        ) : null}
        {detailValue && (
          <Space direction="vertical" size={16} style={{display: 'flex'}}>
            <Descriptions {...adminDetailDescriptionsProps} column={1}>
              <Descriptions.Item label="名称">
                <NameCodeText name={detailValue.name} />
              </Descriptions.Item>
              <Descriptions.Item label="编码">
                <NameCodeText code={detailValue.code} />
              </Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(detailValue.status)}</Descriptions.Item>
              {detailValue.pointType === 'TABLE' && (
                <Descriptions.Item label="容纳人数">{detailValue.seatCapacity ?? '—'}</Descriptions.Item>
              )}
              {detailValue.pointType === 'TABLE' && (
                <Descriptions.Item label="形态">
                  {detailValue.tableShape ? storeServicePointShapeLabels[detailValue.tableShape] : '—'}
                </Descriptions.Item>
              )}
              {detailValue.pointType === 'TABLE' && (
                <Descriptions.Item label="是否可预约">
                  {detailValue.reservable === null || detailValue.reservable === undefined
                    ? '—'
                    : detailValue.reservable
                      ? '是'
                      : '否'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="是否可用">{detailValue.effectiveAvailable ? '是' : '否'}</Descriptions.Item>
            </Descriptions>
            {detailValue.imageAssetRef && (
              <AssetPreview
                assetRef={String(detailValue.imageAssetRef)}
                alt={`${detailValue.name}图片`}
                width={160}
                height={120}
              />
            )}
            {extensionDefinition && renderExtensionDetails(detailValue)}
            <Card size="small" title="二维码结果" {...testId(storeServicePointTestIds.qrResult)}>
              {qrDisplayValue(
                detailValue.qrUrl,
                qrConfiguration,
                detailValue.effectiveAvailable,
                {loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)},
                176,
                storeServicePointTestIds.qrResultImage(detailValue.pointRef),
              )}
            </Card>
          </Space>
        )}
      </Drawer>

      <Drawer
        open={qrEditOpen}
        title="编辑二维码配置"
        onClose={qrLifecycle.requestClose}
        afterOpenChange={qrLifecycle.afterOpenChange}
        destroyOnHidden
        maskClosable={!qrLifecycle.submitting}
        keyboard={!qrLifecycle.submitting}
        closable={!qrLifecycle.submitting}
        {...adminDrawerSurfaceProps}
        {...testId(storeServicePointTestIds.qrDrawer)}
        footer={
          <Space>
            <Button
              onClick={qrLifecycle.requestClose}
              disabled={qrLifecycle.submitting}
              {...testId(storeServicePointTestIds.qrCancel)}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={qrLifecycle.submitting}
              disabled={!qrConfiguration || candidateQuery.isFetching}
              onClick={() => qrForm.submit()}
              {...testId(storeServicePointTestIds.qrSave)}
            >
              保存
            </Button>
          </Space>
        }
      >
        {candidateQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="门店渠道读取失败"
            description={problemText(candidateQuery.error, '请重试。')}
            action={<Button onClick={() => void candidateQuery.refetch()}>重试</Button>}
          />
        ) : null}
        <Form
          form={qrForm}
          layout="vertical"
          disabled={qrLifecycle.submitting}
          onFinish={values => {
            qrLifecycle.setSubmitting(true);
            void changeQrConfiguration(values)
              .catch(error => setFeedback({type: 'error', message: problemText(error, '二维码配置保存失败，请重试。')}))
              .finally(() => qrLifecycle.setSubmitting(false));
          }}
          onValuesChange={() => {
            qrLifecycle.setDirty(true);
            qrLifecycle.markBusinessIntentChanged();
          }}
        >
          <Form.Item name="enabled" label="是否开启二维码下单" valuePropName="checked">
            <Switch {...testId(storeServicePointTestIds.qrEnabled)} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.enabled !== current.enabled}>
            {({getFieldValue}) => (
              <Form.Item
                name="channelRef"
                label="门店渠道"
                rules={getFieldValue('enabled') ? [{required: true, message: '开启二维码下单后请选择门店渠道'}] : []}
                help={!getFieldValue('enabled') ? '未开启时可以不选择渠道。' : undefined}
              >
                <Select
                  allowClear={!getFieldValue('enabled')}
                  loading={candidateQuery.isFetching}
                  options={qrOptions}
                  placeholder="请选择门店渠道"
                  {...testId(storeServicePointTestIds.qrChannel)}
                />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
