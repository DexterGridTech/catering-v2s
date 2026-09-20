import {MoreOutlined, PlusOutlined} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Skeleton,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type {MenuProps, TableColumnsType} from 'antd';
import {
  AdminRowActionMenu,
  adminDetailDescriptionsProps,
  adminListState,
  displayFieldValue,
  CursorPagination,
  lifecycleColor,
  StatusChangeConfirm,
  testId,
  useDetailDrawer,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf} from '../../../app/api/OperationsTransport';
import {
  type StoreQrChannelCandidate,
  type StoreServicePoint,
  type StoreServicePointArea,
  type StoreServicePointShape,
  type StoreServicePointStatus,
} from '../../../app/api/generated/operations-edge';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import {OperationsStoreCatalogManagementDisabledSurface} from '../../../app/components/OperationsStoreCatalogManagementDisabledSurface';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useStoreOperatingRuleGate} from '../../store-operating-rules/model/useStoreOperatingRuleGate';
import {
  type AreaEditor,
  type AreaFormValues,
  areaTypeForPointType,
  hydrateStoreServicePointExtensionValues,
  storeServicePointAreaTypeLabels,
  storeServicePointShapeLabels,
  storeServicePointStatusLabels,
  STORE_SERVICE_POINT_OPERATION_COLUMN_TITLE,
  type PointEditor,
  type PointFormValues,
  type QrFormValues,
  type StoreServicePointImage,
  STORE_SERVICE_POINT_IMAGE_LIMITS,
  titleForArea,
} from '../model/storeServicePointModel';
import {
  changeStoreServicePointAreaStatus,
  changeStoreServicePointStatus,
  moveStoreServicePoint,
  moveStoreServicePointArea,
  releaseStoreServicePointImages,
  saveStoreQrConfiguration,
  saveStoreServicePoint,
  saveStoreServicePointArea,
  stageStoreServicePointImage,
} from '../model/commands';
import {useStoreServicePointReadModel} from '../model/useStoreServicePointReadModel';
import {storeServicePointTestIds} from '../storeServicePointTestIds';
import {AreaDrawer} from './AreaDrawer';
import {QrConfigurationDrawer} from './QrConfigurationDrawer';
import {ServicePointDetailDrawer} from './ServicePointDetailDrawer';
import {ServicePointDrawer} from './ServicePointDrawer';
import {qrDisplayValue} from './ServicePointQrDisplay';

type SortPending = {target: 'area' | 'point'; ref: string};
type StatusChangeRequest = {
  target: 'area' | 'point';
  row: StoreServicePointArea | StoreServicePoint;
  status: StoreServicePointStatus;
  label: string;
};

function problemText(error: unknown, fallback: string) {
  const problem = operationsProblemOf(error);
  return problem.detail || fallback;
}

function queryRefetchFailed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'error' in value && (value as {error?: unknown}).error);
}

function statusTag(status: StoreServicePointStatus) {
  return <Tag color={lifecycleColor(status)}>{storeServicePointStatusLabels[status]}</Tag>;
}

export function StoreServicePointPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const {token} = theme.useToken();
  const storeRef = queryContext.scopeRef;
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.EDIT_STORE_SERVICE_POINT_QR);
  const gate = useStoreOperatingRuleGate({queryContext, enabled: Boolean(storeRef), ruleKey: 'tableManagementEnabled'});
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string}>();
  const [selectedAreaRef, setSelectedAreaRef] = useState<string>();
  const [areaEditor, setAreaEditor] = useState<AreaEditor>();
  const [pointEditor, setPointEditor] = useState<PointEditor>();
  const [qrEditOpen, setQrEditOpen] = useState(false);
  const [pointProblem, setPointProblem] = useState<string>();
  const [statusChange, setStatusChange] = useState<StatusChangeRequest>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusProblem, setStatusProblem] = useState<string>();
  const [sortPending, setSortPending] = useState<SortPending | undefined>(undefined);
  const [imageItems, setImageItems] = useState<StoreServicePointImage[]>([]);
  const imageItemsRef = useRef<StoreServicePointImage[]>([]);
  const sortPendingRef = useRef<SortPending | undefined>(undefined);
  const detail = useDetailDrawer<StoreServicePoint>();
  const [areaForm] = Form.useForm<AreaFormValues>();
  const [pointForm] = Form.useForm<PointFormValues>();
  const [qrForm] = Form.useForm<QrFormValues>();
  useOverlayLock(Boolean(statusChange));

  const updateSortPending = useCallback((value: SortPending | undefined) => {
    sortPendingRef.current = value;
    setSortPending(value);
  }, []);

  const read = useStoreServicePointReadModel({
    queryContext,
    gateReady: gate.isEnabled,
    selectedAreaRef,
    detailTarget: detail.target,
    qrEditOpen,
  });
  const {
    storeWireRef,
    scopeReady,
    areaCursor,
    areas,
    selectedArea,
    areasQuery,
    pointCursor,
    points,
    pointsQuery,
    qrConfiguration,
    qrQuery,
    extensionDefinition,
    extensionDefinitionQuery,
    candidateQuery,
    detailValue,
    detailQuery,
    refetchAreas,
    refetchPoints,
    refetchQr,
  } = read;

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
      await saveStoreServicePointArea({
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeWireRef,
        editor: areaEditor,
        operation,
        values,
      });
      await readBack('area-and-points');
      areaLifecycle.setDirty(false);
      areaLifecycle.closeAfterSuccess();
      setFeedback({type: 'success', message: operation === 'create' ? '区域已创建。' : '区域已保存。'});
    },
    [areaEditor, areaLifecycle, queryContext.groupWorkspaceKey, readBack, storeRef, storeWireRef],
  );

  const changeAreaStatus = useCallback(
    async (area: StoreServicePointArea, status: StoreServicePointStatus) => {
      await changeStoreServicePointAreaStatus({
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeWireRef,
        area,
        status,
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
      const pending = {target: 'area' as const, ref: String(area.areaRef)};
      if (sortPendingRef.current?.target === pending.target && sortPendingRef.current.ref === pending.ref) {
        return;
      }
      updateSortPending(pending);
      setFeedback(undefined);
      try {
        await moveStoreServicePointArea({
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeWireRef,
          area,
          direction,
        });
        await readBack('areas');
      } finally {
        if (sortPendingRef.current?.target === pending.target && sortPendingRef.current.ref === pending.ref) {
          updateSortPending(undefined);
        }
      }
    },
    [queryContext.groupWorkspaceKey, readBack, storeWireRef, updateSortPending],
  );

  const releaseStagedImages = useCallback(async () => {
    const failures = await releaseStoreServicePointImages({
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      storeWireRef,
      items: imageItemsRef.current,
    });
    if (failures.length > 0) setPointProblem('图片资产释放未完成，请重试关闭。');
  }, [queryContext.groupWorkspaceKey, storeWireRef]);

  const stagePointImage = useCallback(
    async (file: File, existingId?: string) => {
      if (!pointEditor || pointEditor.areaType !== 'TABLE_AREA') return;
      if (file.size > STORE_SERVICE_POINT_IMAGE_LIMITS.maxImageBytes) {
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
        const response = await stageStoreServicePointImage({
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeWireRef,
          file,
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
      await saveStoreServicePoint({
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeWireRef,
        editor: pointEditor,
        selectedAreaRef,
        extensionDefinitionRevision: extensionDefinition.revision,
        extensionDefinition,
        image,
        values,
      });
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
      await changeStoreServicePointStatus({
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeWireRef,
        point,
        status,
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
      const pending = {target: 'point' as const, ref: String(point.pointRef)};
      if (sortPendingRef.current?.target === pending.target && sortPendingRef.current.ref === pending.ref) {
        return;
      }
      updateSortPending(pending);
      setFeedback(undefined);
      try {
        await moveStoreServicePoint({
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          storeWireRef,
          point,
          direction,
        });
        await readBack('points');
      } finally {
        if (sortPendingRef.current?.target === pending.target && sortPendingRef.current.ref === pending.ref) {
          updateSortPending(undefined);
        }
      }
    },
    [queryContext.groupWorkspaceKey, readBack, storeWireRef, updateSortPending],
  );

  const changeQrConfiguration = useCallback(
    async (values: QrFormValues) => {
      if (!qrConfiguration) return;
      await saveStoreQrConfiguration({
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeWireRef,
        configurationVersion: qrConfiguration.version,
        values,
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
      setStatusProblem(undefined);
      setStatusChange({target, row, status, label});
    },
    [selectedArea?.areaType],
  );

  const confirmStatusChange = useCallback(async () => {
    if (!statusChange || statusSubmitting) return;
    setStatusSubmitting(true);
    setStatusProblem(undefined);
    try {
      if (statusChange.target === 'area') {
        await changeAreaStatus(statusChange.row as StoreServicePointArea, statusChange.status);
      } else {
        await changePointStatus(statusChange.row as StoreServicePoint, statusChange.status);
      }
      setStatusChange(undefined);
    } catch (error) {
      setStatusProblem(problemText(error, `${statusChange.label}状态更新失败，请重试。`));
    } finally {
      setStatusSubmitting(false);
    }
  }, [changeAreaStatus, changePointStatus, statusChange, statusSubmitting]);

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
          disabled:
            !canEdit || !area.canMoveUp || (sortPending?.target === 'area' && sortPending.ref === String(area.areaRef)),
          ...testId(storeServicePointTestIds.areaMenuAction(area.areaRef, 'up')),
        },
        {
          key: 'down',
          label: '下移',
          disabled:
            !canEdit ||
            !area.canMoveDown ||
            (sortPending?.target === 'area' && sortPending.ref === String(area.areaRef)),
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
    [askStatusChange, canEdit, moveArea, sortPending],
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
          disabled:
            !canEdit ||
            !point.canMoveUp ||
            (sortPending?.target === 'point' && sortPending.ref === String(point.pointRef)),
          ...testId(storeServicePointTestIds.pointMenuAction(point.pointRef, 'up')),
        },
        {
          key: 'down',
          label: '下移',
          disabled:
            !canEdit ||
            !point.canMoveDown ||
            (sortPending?.target === 'point' && sortPending.ref === String(point.pointRef)),
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
          setPointEditor({mode: 'edit', areaName: selectedArea.name, areaType: selectedArea.areaType, point});
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
    [askStatusChange, canEdit, movePoint, selectedArea, sortPending],
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
                render: (value: number | null) => displayFieldValue(value),
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
          render: (_value, row) => {
            const menu = pointMenu(row);
            return (
              <AdminRowActionMenu
                items={menu.items ?? []}
                onClick={menu.onClick}
                ariaLabel={`更多${titleForArea(selectedArea?.areaType)}操作`}
                icon={<MoreOutlined />}
                triggerTestId={storeServicePointTestIds.pointMenu(row.pointRef)}
              />
            );
          },
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
                    {(() => {
                      const menu = areaMenu(area);
                      return (
                        <AdminRowActionMenu
                          items={menu.items ?? []}
                          onClick={menu.onClick}
                          ariaLabel="更多区域操作"
                          icon={<MoreOutlined />}
                          triggerTestId={storeServicePointTestIds.areaMenu(area.areaRef)}
                        />
                      );
                    })()}
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
                onClick={() =>
                  setPointEditor({mode: 'create', areaName: selectedArea.name, areaType: selectedArea.areaType})
                }
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

      <AreaDrawer
        editor={areaEditor}
        form={areaForm}
        lifecycle={areaLifecycle}
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
      />

      <ServicePointDrawer
        editor={pointEditor}
        form={pointForm}
        lifecycle={pointLifecycle}
        extensionDefinition={extensionDefinition}
        extensionDefinitionError={extensionDefinitionQuery.error}
        extensionDefinitionLoading={extensionDefinitionQuery.isFetching}
        onRetryExtensionDefinition={() => void extensionDefinitionQuery.refetch()}
        pointProblem={pointProblem}
        imageItems={imageItems}
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
        onAfterOpenChange={visible => {
          pointLifecycle.afterOpenChange(visible);
          if (!visible) void releaseStagedImages();
        }}
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
      />

      <ServicePointDetailDrawer
        open={detail.isOpen}
        value={detailValue}
        canEdit={canEdit}
        extensionDefinition={extensionDefinition}
        qrConfiguration={qrConfiguration}
        qrReadState={{loading: qrQuery.isFetching, failed: Boolean(qrQuery.error)}}
        detailQuery={{isFetching: detailQuery.isFetching, error: detailQuery.error}}
        onClose={detail.close}
        onRetry={() => void detailQuery.refetch()}
        onEdit={value => {
          detail.close();
          if (!selectedArea) return;
          setPointEditor({
            mode: 'edit',
            areaName: selectedArea.name,
            areaType: areaTypeForPointType(value.pointType),
            point: value as StoreServicePoint,
          });
        }}
      />

      <QrConfigurationDrawer
        open={qrEditOpen}
        form={qrForm}
        lifecycle={qrLifecycle}
        options={qrOptions}
        configurationReady={Boolean(qrConfiguration)}
        candidatesLoading={candidateQuery.isFetching}
        candidatesError={candidateQuery.error}
        onRetryCandidates={() => void candidateQuery.refetch()}
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
      />

      <StatusChangeConfirm
        open={Boolean(statusChange)}
        title={
          statusChange
            ? statusChange.status === 'VOIDED'
              ? `确认作废${statusChange.label}？`
              : `确认${statusChange.status === 'ENABLED' ? '启用' : '停用'}${statusChange.label}？`
            : '确认状态操作'
        }
        actionLabel={statusChange?.status === 'VOIDED' ? '作废' : statusChange?.status === 'ENABLED' ? '启用' : '停用'}
        dangerous={statusChange?.status === 'VOIDED'}
        submitting={statusSubmitting}
        problem={statusProblem}
        onCancel={() => {
          if (!statusSubmitting) setStatusChange(undefined);
        }}
        onConfirm={() => void confirmStatusChange()}
        confirmTestId={storeServicePointTestIds.statusConfirm}
        cancelTestId={storeServicePointTestIds.statusCancel}
        modalTestId={storeServicePointTestIds.statusModal}
        problemTestId={storeServicePointTestIds.statusProblem}
      >
        {statusChange?.status === 'VOIDED' ? (
          <p>作废后将保留{statusChange.label}历史资料，且不再参与当前列表。</p>
        ) : (
          <p>此操作仅改变{statusChange?.label ?? '对象'}的可用状态。</p>
        )}
      </StatusChangeConfirm>
    </div>
  );
}
