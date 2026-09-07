import {MoreOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type {MenuProps, TableColumnsType} from 'antd';
import {
  CursorPagination,
  adminDrawerSurfaceProps,
  adminListState,
  closedCodeLabel,
  testId,
  useOverlayLock,
  useSubmissionLifecycle,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import {operationsLogger} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import type {
  SalesMenuCommandReadback,
  SalesMenuDetail,
  SalesMenuDraftItemView,
  SalesMenuOperationRecord,
  SalesMenuPublishedItemView,
  SalesMenuSchedule,
  SalesMenuSectionView,
  SalesMenuSummary,
  Uuid,
} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {
  salesMenuChannelStatusLabel,
  salesMenuInventoryAvailabilityLabel,
  salesMenuManualSaleStatusLabel,
  SALES_MENU_OPERATION_COLUMN_TITLE,
  salesMenuOperationLabel,
  salesMenuProductShapeLabel,
  salesMenuScheduleLabel,
  type SalesMenuMode,
} from '../model/salesMenuModel';
import {useSalesMenuCommands} from '../model/useSalesMenuCommands';
import {useSalesMenuReadModel} from '../model/useSalesMenuReadModel';
import {accessKindLabels, orderKindLabels} from '../../business-channel/model/businessChannelCodeLabels';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {AssetPreview} from '../../../app/components/AssetPreview';
import {SalesMenuTaskSurfaces} from './SalesMenuTaskSurfaces';
import {
  commandErrorMessage,
  formatOccurredAt,
  menuStateLabel,
  problemMessage,
  salesMenuConstraintLabel,
  salesMenuPriceLabel,
  salesMenuPublishedPriceLabel,
  salesMenuSpecificationLabel,
  type SalesMenuStackedLabel,
  itemMediaLabel,
  type DraftOrPublishedItem,
  type SalesMenuCommands,
  type SalesMenuReadModel,
} from './salesMenuUiShared';
export {salesMenuCategoryTreeData} from './salesMenuUiShared';

const SalesMenuSelectorInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>((props, ref) => (
  <input {...props} ref={ref} {...testId(salesMenuTestIds.menuSelectorInput)} />
));

SalesMenuSelectorInput.displayName = 'SalesMenuSelectorInput';

type SalesMenuManualTargetKind = 'ITEM' | 'SKU' | 'ORDER_OPTION_VALUE';
type SalesMenuStatusTarget = {
  targetKind: SalesMenuManualTargetKind;
  targetRef: Uuid;
  groupLabel: string;
  label: string;
  state: 'NORMAL' | 'MANUAL_SOLD_OUT';
  reason: string | null;
};

function statusTargetKey(target: Pick<SalesMenuStatusTarget, 'targetKind' | 'targetRef'>): string {
  return `${target.targetKind}:${String(target.targetRef)}`;
}

function statusTargetStateLabel(state: SalesMenuStatusTarget['state']): string {
  return state === 'MANUAL_SOLD_OUT' ? '人工沽清' : '正常销售';
}

function SalesMenuStackedCell({value}: {value: SalesMenuStackedLabel}) {
  if (!Array.isArray(value)) return value;
  return (
    <span style={{display: 'grid', gap: 2}}>
      {value.map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
    </span>
  );
}

function SalesMenuSectionPanel({
  read,
  menu,
  canEdit,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  read: SalesMenuReadModel;
  menu?: SalesMenuDetail;
  canEdit: boolean;
  onCreate: () => void;
  onRename: (section: SalesMenuSectionView) => void;
  onDelete: (section: SalesMenuSectionView) => void;
  onMove: (section: SalesMenuSectionView, direction: 'UP' | 'DOWN') => void;
}) {
  const {token} = theme.useToken();
  const page = read.mode === 'PUBLISHED' ? read.publishedSections.page : read.draftSections.page;
  const rows = page?.items ?? [];
  if (read.mode === 'OPERATIONS')
    return (
      <Card title="菜单信息" size="small">
        {menu ? (
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="菜单状态">{menuStateLabel(menu)}</Descriptions.Item>
            <Descriptions.Item label="经营入口">
              {salesMenuChannelStatusLabel(menu.activation?.status ?? 'DISABLED')}
            </Descriptions.Item>
            <Descriptions.Item label="菜单时段">{salesMenuScheduleLabel(menu.draftSchedule)}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Spin />
        )}
      </Card>
    );
  return (
    <Card
      size="small"
      title="销售分区"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreate}
          disabled={!canEdit}
          {...testId(salesMenuTestIds.sectionCreate)}
        >
          新建分区
        </Button>
      }
      {...testId(salesMenuTestIds.sectionList)}
    >
      <Space direction="vertical" size={4} style={{display: 'flex'}}>
        {rows.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无销售分区" />}
        {rows.map(section => {
          const active = read.selectedSectionRef === section.salesSectionRef;
          const menuItems: MenuProps['items'] = [
            {
              key: 'rename',
              label: '重命名',
              disabled: !canEdit,
              ...testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'rename')),
            },
            {
              key: 'up',
              label: '上移',
              disabled: !canEdit || !section.canMoveUp,
              ...testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'up')),
            },
            {
              key: 'down',
              label: '下移',
              disabled: !canEdit || !section.canMoveDown,
              ...testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'down')),
            },
            {type: 'divider'},
            {
              key: 'delete',
              label: '删除分区',
              danger: true,
              disabled: !canEdit,
              ...testId(salesMenuTestIds.sectionMenuAction(section.salesSectionRef, 'delete')),
            },
          ];
          return (
            <div key={section.salesSectionRef} style={{display: 'flex', alignItems: 'center', gap: 4, minWidth: 0}}>
              <Button
                type="text"
                onClick={() => read.setSelectedSectionRef(section.salesSectionRef)}
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
                  justifyContent: 'flex-start',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                aria-current={active ? 'true' : undefined}
                {...testId(salesMenuTestIds.section(section.salesSectionRef))}
              >
                {section.name} <Typography.Text type="secondary">({section.itemCount})</Typography.Text>
              </Button>
              <Dropdown
                menu={{
                  items: menuItems,
                  onClick: event => {
                    if (event.key === 'rename') onRename(section);
                    if (event.key === 'delete') onDelete(section);
                    if (event.key === 'up' || event.key === 'down') onMove(section, event.key === 'up' ? 'UP' : 'DOWN');
                  },
                }}
              >
                <Button
                  type="text"
                  icon={<MoreOutlined />}
                  aria-label="更多分区操作"
                  {...testId(salesMenuTestIds.sectionAction(section.salesSectionRef))}
                />
              </Dropdown>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

function DraftSalesItemTable({
  read,
  canEdit,
  onAdd,
  onEdit,
  onMove,
}: {
  read: SalesMenuReadModel;
  canEdit: boolean;
  onAdd: (trigger: HTMLElement) => void;
  onEdit: (item: SalesMenuDraftItemView, trigger: HTMLElement) => void;
  onMove: (item: SalesMenuDraftItemView, direction: 'UP' | 'DOWN') => void;
}) {
  const page = read.draftItems.page;
  const rows = page?.items ?? [];
  const error = problemMessage(read.draftItems.query.error, '草稿销售项暂时无法获取，请重试。');
  const columns: TableColumnsType<SalesMenuDraftItemView> = [
    {
      title: '菜单商品',
      key: 'displayName',
      fixed: 'left',
      width: 210,
      render: (_, row) => (
        <Space align="start" size={8}>
          <Space direction="vertical" size={2} align="center" style={{width: 96, flex: '0 0 96px'}}>
            <AssetPreview
              assetRef={
                row.displayMedia.mode === 'CUSTOM'
                  ? (row.displayMedia.primaryAssetRef ?? undefined)
                  : (row.catalogPrimaryImageAssetRef ?? undefined)
              }
              alt={`${row.displayName}展示图`}
              width={96}
              height={72}
            />
            <Typography.Text type="secondary" style={{fontSize: 12, whiteSpace: 'nowrap'}}>
              {itemMediaLabel(row)}
            </Typography.Text>
          </Space>
          <Space direction="vertical" size={0} style={{minWidth: 0}}>
            <Button
              type="link"
              style={{padding: 0, height: 'auto', maxWidth: '100%', display: 'block', textAlign: 'left'}}
              onClick={event => onEdit(row, event.currentTarget)}
              {...testId(salesMenuTestIds.item(row.salesItemRef))}
            >
              {row.displayName}
            </Button>
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              {row.itemCode}
            </Typography.Text>
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              {salesMenuProductShapeLabel(row.productShape)}
            </Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '挂牌价',
      key: 'price',
      width: 108,
      render: (_, row) => <SalesMenuStackedCell value={salesMenuPriceLabel(row)} />,
    },
    {
      title: '销售规格',
      key: 'saleContent',
      width: 120,
      render: (_, row) => <SalesMenuStackedCell value={salesMenuSpecificationLabel(row)} />,
    },
    {
      title: '销售约束',
      key: 'constraints',
      width: 110,
      render: (_, row) => <SalesMenuStackedCell value={salesMenuConstraintLabel(row)} />,
    },
    {
      title: SALES_MENU_OPERATION_COLUMN_TITLE,
      key: 'actions',
      fixed: 'right',
      width: 72,
      render: (_, row) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'up',
                label: '上移',
                disabled: !canEdit || !row.canMoveUp,
                ...testId(salesMenuTestIds.itemMenuAction(row.salesItemRef, 'up')),
              },
              {
                key: 'down',
                label: '下移',
                disabled: !canEdit || !row.canMoveDown,
                ...testId(salesMenuTestIds.itemMenuAction(row.salesItemRef, 'down')),
              },
            ],
            onClick: event => {
              if (event.key === 'up' || event.key === 'down') onMove(row, event.key === 'up' ? 'UP' : 'DOWN');
            },
          }}
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            aria-label="更多销售项操作"
            {...testId(salesMenuTestIds.itemAction(row.salesItemRef, 'menu'))}
          />
        </Dropdown>
      ),
    },
  ];
  return (
    <Card
      size="small"
      title="草稿销售项"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={event => onAdd(event.currentTarget)}
          disabled={!canEdit}
          {...testId(salesMenuTestIds.candidateAdd)}
        >
          添加商品到菜单
        </Button>
      }
      {...testId(salesMenuTestIds.itemTable)}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={() => void read.draftItems.query.refetch()}>重试</Button>}
          />
        )}
        <Table<SalesMenuDraftItemView>
          size="small"
          tableLayout="fixed"
          rowKey="salesItemRef"
          {...adminListState({
            loading: read.draftItems.query.isFetching,
            failed: Boolean(error),
            emptyText: '该分区暂无菜单商品',
            testIdPrefix: salesMenuTestIds.draftList,
          })}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{x: 620}}
        />
        <CursorPagination
          state={read.draftItems.cursor}
          nextCursor={page?.nextCursor ?? undefined}
          testIdPrefix={salesMenuTestIds.draftCursor}
        />
      </Space>
    </Card>
  );
}

function PublishedSalesItemTable({
  read,
  onDetail,
  onStatus,
}: {
  read: SalesMenuReadModel;
  onDetail: (item: SalesMenuPublishedItemView) => void;
  onStatus: (item: SalesMenuPublishedItemView) => void;
}) {
  const page = read.publishedItems.page;
  const rows = page?.items ?? [];
  const error = problemMessage(read.publishedItems.query.error, '前台销售项暂时无法获取，请重试。');
  const columns: TableColumnsType<SalesMenuPublishedItemView> = [
    {
      title: '菜单商品',
      key: 'displayName',
      fixed: 'left',
      width: 165,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{padding: 0, height: 'auto'}}
            onClick={() => onDetail(row)}
            {...testId(salesMenuTestIds.item(row.salesItemRef))}
          >
            {row.displayName}
          </Button>
          <Typography.Text type="secondary" style={{fontSize: 12}}>
            {row.itemCode}
          </Typography.Text>
          <Typography.Text type="secondary" style={{fontSize: 12}}>
            {salesMenuProductShapeLabel(row.productShape)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '挂牌价',
      key: 'price',
      width: 80,
      render: (_, row) => <SalesMenuStackedCell value={salesMenuPublishedPriceLabel(row)} />,
    },
    {
      title: '销售规格',
      key: 'saleContent',
      width: 147,
      render: (_, row) => <SalesMenuStackedCell value={salesMenuSpecificationLabel(row)} />,
    },
    {
      title: '库存状态',
      key: 'inventory',
      width: 130,
      render: (_, row) => salesMenuInventoryAvailabilityLabel(row.inventoryAvailability),
    },
    {
      title: '销售状态',
      key: 'saleStatus',
      fixed: 'right',
      width: 130,
      render: (_, row) => (
        <Button type="link" onClick={() => onStatus(row)} {...testId(salesMenuTestIds.statusAction(row.salesItemRef))}>
          {salesMenuManualSaleStatusLabel(row.manualSaleStatus)}
        </Button>
      ),
    },
  ];
  return (
    <Card size="small" title="前台菜单" {...testId(salesMenuTestIds.itemTable)}>
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={() => void read.publishedItems.query.refetch()}>重试</Button>}
          />
        )}
        <Table<SalesMenuPublishedItemView>
          size="small"
          tableLayout="fixed"
          rowKey="salesItemRef"
          {...adminListState({
            loading: read.publishedItems.query.isFetching,
            failed: Boolean(error),
            emptyText: '该分区暂无菜单商品',
            testIdPrefix: salesMenuTestIds.publishedList,
          })}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{x: 652}}
        />
        <CursorPagination
          state={read.publishedItems.cursor}
          nextCursor={page?.nextCursor ?? undefined}
          testIdPrefix={salesMenuTestIds.publishedCursor}
        />
      </Space>
    </Card>
  );
}

function SalesMenuOperationTable({read}: {read: SalesMenuReadModel}) {
  const page = read.operationRecords.page;
  const rows = page?.items ?? [];
  const error = problemMessage(read.operationRecords.query.error, '操作记录暂时无法获取，请重试。');
  const columns: TableColumnsType<SalesMenuOperationRecord> = [
    {title: '时间', key: 'occurredAt', width: 190, render: (_, row) => formatOccurredAt(row.occurredAt)},
    {
      title: SALES_MENU_OPERATION_COLUMN_TITLE,
      key: 'operationKind',
      render: (_, row) => salesMenuOperationLabel(row.operationKind),
    },
    {title: '结果', key: 'result', render: (_, row) => (row.result === 'SUCCESS' ? '成功' : '失败')},
    {title: '操作人', dataIndex: 'actorDisplayName', key: 'actorDisplayName'},
  ];
  return (
    <Card size="small" title="操作记录" {...testId(salesMenuTestIds.operationLog)}>
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={() => void read.operationRecords.query.refetch()}>重试</Button>}
          />
        )}
        <Table<SalesMenuOperationRecord>
          size="small"
          rowKey="operationRecordRef"
          {...adminListState({
            loading: read.operationRecords.query.isFetching,
            failed: Boolean(error),
            emptyText: '暂无操作记录',
            testIdPrefix: salesMenuTestIds.operationList,
          })}
          dataSource={rows}
          columns={columns}
          pagination={false}
        />
        <CursorPagination
          state={read.operationRecords.cursor}
          nextCursor={page?.nextCursor ?? undefined}
          testIdPrefix={salesMenuTestIds.logCursor}
        />
      </Space>
    </Card>
  );
}

export function SalesMenuPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const read = useSalesMenuReadModel({queryContext});
  const commands = useSalesMenuCommands();
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.EDIT_STORE_SALES_MENU);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string}>();
  const [managerOpen, setManagerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [menuActionTarget, setMenuActionTarget] = useState<SalesMenuSummary>();
  const [renameOpen, setRenameOpen] = useState(false);
  const [sectionDialog, setSectionDialog] = useState<{kind: 'create' | 'rename'; section?: SalesMenuSectionView}>();
  const [sectionName, setSectionName] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState<SalesMenuSchedule>({
    kind: 'ALL_DAY',
    startLocalTime: null,
    endLocalTime: null,
  });
  const [publishOpen, setPublishOpen] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<SalesMenuDraftItemView>();
  const [editorOpen, setEditorOpen] = useState(false);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const candidateTriggerRef = useRef<HTMLElement | null>(null);
  const createTriggerRef = useRef<HTMLElement | null>(null);
  const menuActionTriggerRef = useRef<HTMLElement | null>(null);
  const [detailItem, setDetailItem] = useState<DraftOrPublishedItem>();
  const [statusItem, setStatusItem] = useState<SalesMenuPublishedItemView>();
  const [statusTargetRef, setStatusTargetRef] = useState<string>();
  const [statusChoice, setStatusChoice] = useState<'NORMAL' | 'SOLD_OUT'>('NORMAL');
  const [soldOutReason, setSoldOutReason] = useState('');
  const statusReasonRef = useRef<HTMLTextAreaElement | null>(null);
  const [confirmation, setConfirmation] = useState<{title: string; content: ReactNode; run: () => Promise<void>}>();
  const statusSubmission = useSubmissionLifecycle();
  useOverlayLock(Boolean(statusItem));

  const selectedMenu = read.selectedMenu;
  const selectedMenuRef = read.selectedMenuRef;
  const selectedChannelRef = read.selectedChannelRef;
  const storeRef = read.storeRef;
  const basePath = useMemo(
    () =>
      storeRef && selectedMenuRef
        ? {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef, salesMenuRef: selectedMenuRef}
        : undefined,
    [queryContext.groupWorkspaceKey, selectedMenuRef, storeRef],
  );

  const createLifecycle = useDrawerFormLifecycle({
    open: createOpen,
    onOpenChange: setCreateOpen,
    dirtyMessage: '菜单名称尚未保存。',
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsSalesMenu,
    idempotencyKey: true,
  });
  const renameLifecycle = useDrawerFormLifecycle({
    open: renameOpen,
    onOpenChange: setRenameOpen,
    dirtyMessage: '菜单名称尚未保存。',
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.renameOperationsSalesMenu,
    idempotencyKey: true,
  });
  const scheduleLifecycle = useDrawerFormLifecycle({
    open: scheduleOpen,
    onOpenChange: setScheduleOpen,
    dirtyMessage: '菜单时段尚未保存。',
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuSchedule,
    idempotencyKey: true,
  });
  const resetCreateLifecycle = createLifecycle.reset;
  const resetRenameLifecycle = renameLifecycle.reset;
  const resetScheduleLifecycle = scheduleLifecycle.reset;
  useEffect(() => {
    if (createOpen) {
      resetCreateLifecycle();
      setCreateName('');
    }
  }, [createOpen, resetCreateLifecycle]);
  useEffect(() => {
    if (renameOpen) resetRenameLifecycle();
  }, [renameOpen, resetRenameLifecycle]);
  useEffect(() => {
    if (scheduleOpen) resetScheduleLifecycle();
  }, [resetScheduleLifecycle, scheduleOpen]);
  useEffect(() => {
    if (statusItem) statusSubmission.reset();
  }, [statusItem, statusSubmission]);
  const createAfterOpenChange = useCallback(
    (visible: boolean) => {
      createLifecycle.afterOpenChange(visible);
      if (!visible) {
        setCreateName('');
        if (createTriggerRef.current) {
          window.requestAnimationFrame(() => {
            createTriggerRef.current?.focus();
            createTriggerRef.current = null;
          });
        }
      }
    },
    [createLifecycle],
  );
  const renameAfterOpenChange = useCallback(
    (visible: boolean) => {
      renameLifecycle.afterOpenChange(visible);
      if (!visible) {
        setRenameName('');
        setMenuActionTarget(undefined);
        if (menuActionTriggerRef.current) {
          window.requestAnimationFrame(() => {
            menuActionTriggerRef.current?.focus();
            menuActionTriggerRef.current = null;
          });
        }
      }
    },
    [renameLifecycle],
  );
  const scheduleAfterOpenChange = useCallback(
    (visible: boolean) => {
      scheduleLifecycle.afterOpenChange(visible);
      if (!visible && menuActionTriggerRef.current) {
        window.requestAnimationFrame(() => {
          menuActionTriggerRef.current?.focus();
          menuActionTriggerRef.current = null;
        });
      }
    },
    [scheduleLifecycle],
  );

  const runCommand = useCallback(
    async (operation: () => Promise<unknown>, success: string, after?: (result: unknown) => void): Promise<boolean> => {
      setFeedback(undefined);
      try {
        const result = await operation();
        after?.(result);
        setFeedback({type: 'success', message: success});
        return true;
      } catch (error) {
        setFeedback({type: 'error', message: commandErrorMessage(error, '操作未完成，请检查后重试。')});
        return false;
      }
    },
    [],
  );

  const askConfirmation = useCallback((title: string, content: ReactNode, run: () => Promise<void>) => {
    setConfirmation({title, content, run});
  }, []);

  const statusTargets = useMemo<SalesMenuStatusTarget[]>(() => {
    if (!statusItem) return [];
    const childStatusByKey = new Map(
      statusItem.manualSaleTargetStatuses.map(status => [statusTargetKey(status), status] as const),
    );
    const childTarget = (
      targetKind: Exclude<SalesMenuManualTargetKind, 'ITEM'>,
      targetRef: Uuid,
      groupLabel: string,
      label: string,
    ): SalesMenuStatusTarget => {
      const status = childStatusByKey.get(statusTargetKey({targetKind, targetRef}));
      return {
        targetKind,
        targetRef,
        groupLabel,
        label,
        state: status?.state ?? 'NORMAL',
        reason: status?.reason ?? null,
      };
    };
    const targets: SalesMenuStatusTarget[] = [
      {
        targetKind: 'ITEM',
        targetRef: statusItem.salesItemRef,
        groupLabel: '整个销售项',
        label: statusItem.displayName,
        state: statusItem.manualSaleStatus.state,
        reason: statusItem.manualSaleStatus.reason,
      },
    ];
    if (statusItem.saleContent.kind === 'SKU_SELECTION') {
      targets.push(
        ...statusItem.saleContent.skuPrices.map(price =>
          childTarget('SKU', price.skuRef, '销售规格', price.skuName),
        ),
      );
    }
    if (statusItem.saleContent.kind === 'DIRECT') {
      for (const option of statusItem.saleContent.selectedOrderOptions) {
        for (const value of option.values) {
          targets.push(
            childTarget(
              'ORDER_OPTION_VALUE',
              value.definitionValueRef,
              `销售选项：${option.name}`,
              value.name,
            ),
          );
        }
      }
    }
    return targets;
  }, [statusItem]);

  const selectedStatusTarget = statusTargets.find(target => statusTargetKey(target) === statusTargetRef);

  useEffect(() => {
    if (!statusItem || commands.isBusy) return;
    const refreshed = read.publishedItems.page?.items.find(item => item.salesItemRef === statusItem.salesItemRef);
    if (refreshed && refreshed !== statusItem) setStatusItem(refreshed);
  }, [commands.isBusy, read.publishedItems.page, statusItem]);

  const refreshPublishedStatus = useCallback(() => {
    void read.refresh().catch(error => {
      operationsLogger.warn({
        event: 'sales-menu.status',
        phase: 'READBACK',
        outcome: 'FAILED',
        operationId: 'sales-menu-status-readback',
        errorCode: error instanceof Error ? error.message : 'SALES_MENU_STATUS_READBACK_FAILED',
      });
    });
  }, [read.refresh]);

  const createMenu = useCallback(async () => {
    if (!storeRef || !selectedChannelRef || !createName.trim()) return;
    createLifecycle.setSubmitting(true);
    const succeeded = await runCommand(
      () =>
        commands.create(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef},
          {channelRef: selectedChannelRef, name: createName.trim()},
        ),
      '菜单已创建。',
      () => createLifecycle.closeAfterSuccess(),
    );
    if (!succeeded) createLifecycle.setSubmitting(false);
  }, [commands, createLifecycle, createName, queryContext.groupWorkspaceKey, runCommand, selectedChannelRef, storeRef]);

  const renameMenu = useCallback(async () => {
    if (!storeRef || !menuActionTarget || !renameName.trim()) return;
    renameLifecycle.setSubmitting(true);
    const succeeded = await runCommand(
      () =>
        commands.rename(
          {
            groupWorkspaceKey: queryContext.groupWorkspaceKey,
            storeRef,
            salesMenuRef: menuActionTarget.salesMenuRef,
          },
          {name: renameName.trim(), expectedVersion: menuActionTarget.version},
        ),
      '菜单名称已更新。',
      () => renameLifecycle.closeAfterSuccess(),
    );
    if (!succeeded) renameLifecycle.setSubmitting(false);
  }, [commands, menuActionTarget, queryContext.groupWorkspaceKey, renameLifecycle, renameName, runCommand, storeRef]);

  const saveSchedule = useCallback(async () => {
    if (!basePath || !selectedMenu) return;
    if (schedule.kind === 'DAILY_TIME_RANGE' && (!schedule.startLocalTime || !schedule.endLocalTime)) return;
    scheduleLifecycle.setSubmitting(true);
    const succeeded = await runCommand(
      () => commands.schedule(basePath, {schedule, expectedVersion: selectedMenu.version}),
      '菜单时段已保存，更新到前台后生效。',
      () => scheduleLifecycle.closeAfterSuccess(),
    );
    if (!succeeded) scheduleLifecycle.setSubmitting(false);
  }, [basePath, commands, runCommand, schedule, scheduleLifecycle, selectedMenu]);

  const openRenameMenu = useCallback((menu: SalesMenuSummary) => {
    setManagerOpen(false);
    setMenuActionTarget(menu);
    setRenameName(menu.name);
    setRenameOpen(true);
  }, []);

  const copyMenu = useCallback(
    (menu: SalesMenuSummary) => {
      if (!storeRef) return;
      void runCommand(
        () =>
          commands.copy(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef,
              salesMenuRef: menu.salesMenuRef,
            },
            {expectedVersion: menu.version},
          ),
        '菜单已复制，并已刷新菜单列表。',
        result => {
          const targetRef = (result as SalesMenuCommandReadback).targetRef;
          if (targetRef) read.selectMenu(targetRef);
        },
      );
    },
    [commands, queryContext.groupWorkspaceKey, read, runCommand, storeRef],
  );

  const archiveMenu = useCallback(
    (menu: SalesMenuSummary) => {
      if (!storeRef) return;
      askConfirmation('归档当前菜单？', '归档只会停止当前菜单的管理使用，不会删除商品或历史操作记录。', async () => {
        await runCommand(
          () =>
            commands.archive(
              {
                groupWorkspaceKey: queryContext.groupWorkspaceKey,
                storeRef,
                salesMenuRef: menu.salesMenuRef,
              },
              {expectedVersion: menu.version},
            ),
          '菜单已归档。',
        );
      });
    },
    [askConfirmation, commands, queryContext.groupWorkspaceKey, runCommand, storeRef],
  );

  const toggleMenu = useCallback(
    (menu: SalesMenuSummary) => {
      if (!storeRef || !selectedChannelRef || !canEdit) return;
      const nextStatus = menu.activation?.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
      operationsLogger.info({
        event: 'sales-menu.manager.activation',
        phase: 'COMMAND_INPUT',
        outcome: 'VERSION_BOUND',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.setOperationsSalesMenuActivation,
        diagnostic: {
          salesMenuRef: menu.salesMenuRef,
          menuVersion: menu.version,
          selectedMenuVersion: selectedMenu?.salesMenuRef === menu.salesMenuRef ? (selectedMenu.version ?? null) : null,
          status: nextStatus,
          expectedVersionSource: 'SALES_MENU_MANAGER_READ_MODEL',
        },
      });
      void runCommand(
        () =>
          commands.activate(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef,
              salesMenuRef: menu.salesMenuRef,
              channelRef: selectedChannelRef,
            },
            {
              status: nextStatus,
              expectedVersion: menu.version,
            },
          ),
        nextStatus === 'DISABLED' ? '菜单已停用。' : '菜单已启用。',
      );
    },
    [canEdit, commands, queryContext.groupWorkspaceKey, runCommand, selectedChannelRef, selectedMenu, storeRef],
  );

  const saveItem = useCallback(
    async (
      item: SalesMenuDraftItemView,
      body: Parameters<SalesMenuCommands['updateItem']>[1],
      grants: Record<string, string>,
    ) => {
      if (!basePath) return false;
      try {
        await commands.updateItem({...basePath, salesItemRef: item.salesItemRef}, body, grants);
        setFeedback({type: 'success', message: '销售项已保存。'});
        return true;
      } catch (error) {
        setFeedback({type: 'error', message: commandErrorMessage(error, '销售项保存失败，请检查后重试。')});
        throw error;
      }
    },
    [basePath, commands],
  );

  const deleteItem = useCallback(
    (item: SalesMenuDraftItemView, beforeDelete?: () => Promise<boolean>) => {
      if (!basePath || !canEdit || !selectedMenu) return;
      askConfirmation(
        '删除当前草稿销售项？',
        '只移除当前草稿销售项，不删除商品，也不影响同一商品的其他销售项。',
        async () => {
          if (beforeDelete && !(await beforeDelete())) return;
          await runCommand(
            () =>
              commands.deleteItem(
                {...basePath, salesItemRef: item.salesItemRef},
                {expectedVersion: selectedMenu.version},
              ),
            '销售项已删除。',
            () => {
              if (editorItem?.salesItemRef === item.salesItemRef) setEditorOpen(false);
            },
          );
        },
      );
    },
    [askConfirmation, basePath, canEdit, commands, editorItem?.salesItemRef, runCommand, selectedMenu],
  );

  const deleteSection = useCallback(
    (section: SalesMenuSectionView) => {
      if (!basePath || !canEdit || !selectedMenu) return;
      askConfirmation(
        '删除当前销售分区？',
        '删除分区只影响当前销售菜单；分区中的商品不会从商品目录删除。',
        async () => {
          await runCommand(
            () =>
              commands.deleteSection(
                {...basePath, salesSectionRef: section.salesSectionRef},
                {expectedVersion: selectedMenu.version},
              ),
            '销售分区已删除。',
          );
        },
      );
    },
    [askConfirmation, basePath, canEdit, commands, runCommand, selectedMenu],
  );

  const addCandidates = useCallback(
    async (refs: Uuid[]) => {
      if (!basePath || !read.selectedSectionRef || !selectedMenu || !canEdit) return false;
      try {
        await commands.addItems(
          {...basePath, salesSectionRef: read.selectedSectionRef},
          {catalogItemRefs: refs, expectedVersion: selectedMenu.version},
        );
        setFeedback({type: 'success', message: '商品已添加到菜单。'});
        return true;
      } catch (error) {
        setFeedback({type: 'error', message: commandErrorMessage(error, '商品添加失败，请检查后重试。')});
        return false;
      }
    },
    [basePath, canEdit, commands, read, selectedMenu],
  );

  const openStatus = useCallback((item: SalesMenuPublishedItemView) => {
    setStatusItem(item);
    setStatusTargetRef(statusTargetKey({targetKind: 'ITEM', targetRef: item.salesItemRef}));
    setStatusChoice(item.manualSaleStatus.state === 'MANUAL_SOLD_OUT' ? 'SOLD_OUT' : 'NORMAL');
    setSoldOutReason(item.manualSaleStatus.reason ?? '');
    statusSubmission.reset();
  }, []);

  const selectStatusTarget = useCallback(
    (nextTargetRef: string) => {
      setStatusTargetRef(nextTargetRef);
      const nextTarget = statusTargets.find(target => statusTargetKey(target) === nextTargetRef);
      if (nextTarget) {
        setStatusChoice(nextTarget.state === 'MANUAL_SOLD_OUT' ? 'SOLD_OUT' : 'NORMAL');
        setSoldOutReason(nextTarget.reason ?? '');
      }
      statusSubmission.markBusinessIntentChanged();
    },
    [statusSubmission, statusTargets],
  );

  const submitStatus = useCallback(() => {
    if (!statusItem || !basePath || !selectedChannelRef || !selectedMenu || !canEdit || !selectedStatusTarget) return;
    if (statusChoice === 'SOLD_OUT' && !soldOutReason.trim()) {
      setFeedback({type: 'error', message: '设置人工沽清时必须填写原因。'});
      window.requestAnimationFrame(() => statusReasonRef.current?.focus());
      return;
    }
    const expectedVersion = selectedMenu.version;
    const operationId =
      statusChoice === 'NORMAL'
        ? OPERATIONS_ADMIN_OPERATION_IDS.restoreOperationsSalesMenuItemSale
        : OPERATIONS_ADMIN_OPERATION_IDS.setOperationsSalesMenuItemSoldOut;
    operationsLogger.info({
      event: 'sales-menu.status',
      phase: 'COMMAND_INPUT',
      outcome: 'VERSION_BOUND',
      operationId,
      diagnostic: {
        salesItemRef: String(statusItem.salesItemRef),
        targetKind: selectedStatusTarget.targetKind,
        targetRef: String(selectedStatusTarget.targetRef),
        channelRef: String(selectedChannelRef),
        itemVersion: statusItem.version,
        menuVersion: expectedVersion,
        expectedVersion,
        expectedVersionSource: 'SALES_MENU_DETAIL',
      },
    });
    if (statusChoice === 'NORMAL') {
      askConfirmation('确认恢复销售？', '恢复的是人工销售状态；库存自动不可售不会在此处恢复。', async () => {
        await runCommand(
          () =>
            commands.restore(
              {...basePath, salesItemRef: statusItem.salesItemRef, channelRef: selectedChannelRef},
              {
                target: {
                  targetKind: selectedStatusTarget.targetKind,
                  targetRef: selectedStatusTarget.targetRef,
                },
                confirm: true,
                expectedVersion,
              },
            ),
          '销售状态已恢复为正常销售。',
          refreshPublishedStatus,
        );
      });
      return;
    }
    void runCommand(
      () =>
          commands.soldOut(
            {...basePath, salesItemRef: statusItem.salesItemRef, channelRef: selectedChannelRef},
            {
              target: {
                targetKind: selectedStatusTarget.targetKind,
                targetRef: selectedStatusTarget.targetRef,
              },
              reason: soldOutReason.trim(),
              expectedVersion,
            },
          ),
      '销售状态已设置为沽清。',
      refreshPublishedStatus,
    );
  }, [
    askConfirmation,
    basePath,
    canEdit,
    commands,
    refreshPublishedStatus,
    runCommand,
    selectedChannelRef,
    selectedMenu,
    soldOutReason,
    statusChoice,
    statusItem,
    selectedStatusTarget,
    statusReasonRef,
  ]);

  const channelItems = read.channels.items;
  const selectorItems = [...read.selector.items];
  if (selectedMenu && !selectorItems.some(menu => menu.salesMenuRef === selectedMenu.salesMenuRef))
    selectorItems.unshift(selectedMenu);
  const channelProblem = problemMessage(read.channels.query.error, '经营入口暂时无法获取，请重试。');
  const channelTemplateProblem = problemMessage(
    read.channels.templateQuery.error,
    '渠道模板信息暂时无法获取，请重试。',
  );
  const menuProblem = problemMessage(read.selector.query.error, '菜单列表暂时无法获取，请重试。');

  return (
    <div {...testId(salesMenuTestIds.page)} data-scope-ref={queryContext.scopeRef}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {feedback && (
          <Alert
            type={feedback.type}
            showIcon
            title={feedback.message}
            closable
            onClose={() => setFeedback(undefined)}
            {...testId(salesMenuTestIds.feedback)}
          />
        )}
        {!read.scopeReady ? (
          <Alert type="info" showIcon title="请先选择门店数据节点。" />
        ) : (
          <>
            <Card title="经营入口" size="small">
              {(channelProblem || channelTemplateProblem) && (
                <Space direction="vertical" size={8} style={{display: 'flex', marginBottom: 12}}>
                  {channelProblem && (
                    <Alert
                      type="error"
                      showIcon
                      title={channelProblem}
                      action={<Button onClick={() => void read.channels.query.refetch()}>重试</Button>}
                    />
                  )}
                  {channelTemplateProblem && (
                    <Alert
                      type="warning"
                      showIcon
                      title={channelTemplateProblem}
                      action={<Button onClick={() => void read.channels.templateQuery.refetch()}>重试</Button>}
                    />
                  )}
                </Space>
              )}
              <Space direction="vertical" size={12} style={{display: 'flex'}}>
                <Row gutter={[12, 12]} align="middle">
                  <Col flex="auto">
                    <Select
                      value={selectedChannelRef}
                      placeholder="选择经营入口"
                      loading={read.channels.query.isFetching}
                      disabled={!read.scopeReady}
                      style={{width: '100%'}}
                      virtual={false}
                      options={channelItems.map(channel => {
                        const template = read.channels.templateByRef.get(channel.templateRef);
                        return {
                          value: channel.channelRef,
                          label: (
                            <Space size={8} wrap={false} style={{display: 'flex', whiteSpace: 'nowrap'}}>
                              <Typography.Text strong style={{whiteSpace: 'nowrap'}}>
                                {channel.channelName}
                              </Typography.Text>
                              <Tag
                                color={
                                  channel.status === 'ENABLED'
                                    ? 'success'
                                    : channel.status === 'VOIDED'
                                      ? 'error'
                                      : 'warning'
                                }
                                style={{marginInlineEnd: 0}}
                              >
                                {salesMenuChannelStatusLabel(channel.status)}
                              </Tag>
                              <Typography.Text type="secondary" style={{whiteSpace: 'nowrap'}}>
                                渠道模板：
                                {template?.templateName ?? (read.channels.templateQuery.isFetching ? '加载中…' : '—')}
                                {' · '}
                                接入：{template ? closedCodeLabel(accessKindLabels, template.accessKind) : '—'}
                                {' · '}
                                订单：{template ? closedCodeLabel(orderKindLabels, template.orderKind) : '—'}
                                {' · '}
                                模板状态：{template ? salesMenuChannelStatusLabel(template.status) : '—'}
                              </Typography.Text>
                            </Space>
                          ),
                          'data-testid': salesMenuTestIds.channelOption(channel.channelRef),
                        };
                      })}
                      onPopupScroll={event =>
                        read.channels.candidates.onPopupScroll(event, read.channels.query.isFetching)
                      }
                      onChange={value => read.selectChannel(value as Uuid)}
                      {...testId(salesMenuTestIds.channelSelector)}
                    />
                  </Col>
                  <Col flex="none">
                    <Button
                      onClick={() => setManagerOpen(true)}
                      disabled={!selectedChannelRef}
                      {...testId(salesMenuTestIds.managerOpen)}
                    >
                      管理菜单
                    </Button>
                  </Col>
                </Row>
                <Row gutter={[12, 12]} align="middle" wrap={false} style={{overflowX: 'auto', paddingBottom: 4}}>
                  <Col flex="none">
                    <Segmented<SalesMenuMode>
                      value={read.mode}
                      onChange={value => read.setMode(value)}
                      options={[
                        {
                          label: <span {...testId(salesMenuTestIds.mode('PUBLISHED'))}>前台菜单</span>,
                          value: 'PUBLISHED',
                        },
                        {label: <span {...testId(salesMenuTestIds.mode('DRAFT'))}>草稿菜单</span>, value: 'DRAFT'},
                        {
                          label: <span {...testId(salesMenuTestIds.mode('OPERATIONS'))}>操作记录</span>,
                          value: 'OPERATIONS',
                        },
                      ]}
                      {...testId(salesMenuTestIds.modes)}
                    />
                  </Col>
                  <Col flex="auto" style={{minWidth: 260}}>
                    <Select
                      value={selectedMenuRef}
                      placeholder="选择菜单"
                      loading={read.selector.query.isFetching}
                      disabled={!selectedChannelRef}
                      showSearch
                      filterOption={false}
                      searchValue={read.selectorQuery}
                      style={{width: '100%', minWidth: 260}}
                      virtual={false}
                      components={{input: SalesMenuSelectorInput}}
                      options={selectorItems.map(menu => ({
                        value: menu.salesMenuRef,
                        label: (
                          <Space wrap={false} style={{whiteSpace: 'nowrap'}}>
                            <span>{menu.name}</span>
                            <Typography.Text type="secondary">{menuStateLabel(menu)}</Typography.Text>
                          </Space>
                        ),
                        'data-testid': salesMenuTestIds.menuOption(menu.salesMenuRef),
                      }))}
                      onPopupScroll={event =>
                        read.selector.candidates.onPopupScroll(event, read.selector.query.isFetching)
                      }
                      onSearch={value => read.setSelectorQuery(value)}
                      onChange={value => {
                        read.setSelectorQuery('');
                        read.selectMenu(value as Uuid);
                      }}
                      {...testId(salesMenuTestIds.menuSelector)}
                    />
                  </Col>
                  {selectedMenu && (
                    <Col flex="none">
                      <Space wrap={false}>
                        <Tag>{menuStateLabel(selectedMenu)}</Tag>
                        <Typography.Text type="secondary">
                          {salesMenuScheduleLabel(selectedMenu.draftSchedule)}
                        </Typography.Text>
                        <Button
                          disabled={!canEdit}
                          onMouseDown={event => (menuActionTriggerRef.current = event.currentTarget)}
                          onClick={() => {
                            setSchedule(selectedMenu.draftSchedule);
                            setScheduleOpen(true);
                          }}
                          {...testId(salesMenuTestIds.menuSchedule)}
                        >
                          生效与时段
                        </Button>
                        {read.mode === 'DRAFT' && (
                          <Button
                            type="primary"
                            disabled={!canEdit || selectedMenu.archived}
                            onClick={() => setPublishOpen(true)}
                            {...testId(salesMenuTestIds.menuPublish)}
                          >
                            更新到前台
                          </Button>
                        )}
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() => void read.refresh()}
                          {...testId(salesMenuTestIds.menuRefresh)}
                        >
                          刷新
                        </Button>
                      </Space>
                    </Col>
                  )}
                </Row>
                {menuProblem && (
                  <Alert
                    type="error"
                    showIcon
                    title={menuProblem}
                    action={<Button onClick={() => void read.selector.query.refetch()}>重试</Button>}
                  />
                )}
              </Space>
              {read.channels.query.isFetching && channelItems.length === 0 && <Spin />}
              {!read.channels.query.isFetching && channelItems.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可管理的经营入口" />
              )}
            </Card>
            {!selectedMenu ? (
              <Card size="small">
                <Empty description={selectedChannelRef ? '请选择菜单' : '请先选择经营入口'} />
              </Card>
            ) : (
              <Row gutter={[16, 16]} align="top">
                <Col xs={24} lg={5} style={{minWidth: 0}}>
                  <SalesMenuSectionPanel
                    read={read}
                    menu={selectedMenu}
                    canEdit={canEdit}
                    onCreate={() => {
                      setSectionName('');
                      setSectionDialog({kind: 'create'});
                    }}
                    onRename={section => {
                      setSectionName(section.name);
                      setSectionDialog({kind: 'rename', section});
                    }}
                    onDelete={deleteSection}
                    onMove={(section, direction) => {
                      if (!basePath || !canEdit) return;
                      void runCommand(
                        () =>
                          commands.moveSection(
                            {...basePath, salesSectionRef: section.salesSectionRef},
                            {direction, expectedVersion: selectedMenu.version},
                          ),
                        '销售分区顺序已更新。',
                      );
                    }}
                  />
                </Col>
                <Col xs={24} lg={19} style={{minWidth: 0}}>
                  {read.mode === 'DRAFT' && (
                    <DraftSalesItemTable
                      read={read}
                      canEdit={canEdit}
                      onAdd={trigger => {
                        candidateTriggerRef.current = trigger;
                        read.openCandidates();
                        setCandidateOpen(true);
                      }}
                      onEdit={(item, trigger) => {
                        editorTriggerRef.current = trigger;
                        setEditorItem(item);
                        setEditorOpen(true);
                      }}
                      onMove={(item, direction) => {
                        if (!basePath || !canEdit) return;
                        void runCommand(
                          () =>
                            commands.moveItem(
                              {...basePath, salesItemRef: item.salesItemRef},
                              {direction, expectedVersion: selectedMenu.version},
                            ),
                          '销售项顺序已更新。',
                        );
                      }}
                    />
                  )}
                  {read.mode === 'PUBLISHED' && (
                    <PublishedSalesItemTable read={read} onDetail={item => setDetailItem(item)} onStatus={openStatus} />
                  )}
                  {read.mode === 'OPERATIONS' && <SalesMenuOperationTable read={read} />}
                </Col>
              </Row>
            )}
          </>
        )}
      </Space>

      <SalesMenuTaskSurfaces
        manager={{
          open: managerOpen,
          read,
          onClose: () => setManagerOpen(false),
          onSelect: menu => {
            read.selectMenu(menu.salesMenuRef);
            setManagerOpen(false);
          },
          onToggle: toggleMenu,
          onRename: openRenameMenu,
          onCopy: copyMenu,
          onArchive: archiveMenu,
          onCreate: trigger => {
            createTriggerRef.current = trigger;
            setCreateOpen(true);
          },
          canEdit,
        }}
        create={{
          open: createOpen,
          name: createName,
          lifecycle: createLifecycle,
          onNameChange: setCreateName,
          onSubmit: () => void createMenu(),
          onAfterOpenChange: createAfterOpenChange,
        }}
        candidate={{
          open: candidateOpen && read.candidateOpen,
          read,
          onClose: () => {
            read.closeCandidates();
            setCandidateOpen(false);
          },
          onAdd: addCandidates,
          onClosedFocus: () => {
            window.requestAnimationFrame(() => {
              candidateTriggerRef.current?.focus();
              candidateTriggerRef.current = null;
            });
          },
        }}
        editor={{
          item: editorItem,
          open: editorOpen,
          queryContext,
          menuRef: selectedMenuRef,
          menuVersion: selectedMenu?.version,
          commands,
          onSave: saveItem,
          onClose: () => setEditorOpen(false),
          onSaved: () => setEditorItem(undefined),
          onDelete: deleteItem,
          onClosedFocus: () => {
            editorTriggerRef.current?.focus();
            editorTriggerRef.current = null;
          },
        }}
        detail={{
          item: detailItem,
          open: Boolean(detailItem),
          queryContext,
          menuRef: selectedMenuRef,
          channelRef: selectedChannelRef,
          onClose: () => setDetailItem(undefined),
        }}
        publish={{
          open: publishOpen,
          read,
          canEdit,
          onClose: () => setPublishOpen(false),
          onPublish: () => {
            if (!basePath || !selectedMenu) return;
            void runCommand(
              () => commands.publish(basePath, {expectedVersion: selectedMenu.version}),
              '本系统已生成新的前台菜单。该结果不代表收银端、扫码端或自助机已经获取。',
              () => setPublishOpen(false),
            );
          },
        }}
      />

      <Drawer
        open={renameOpen}
        title="重命名菜单"
        onClose={renameLifecycle.requestClose}
        afterOpenChange={renameAfterOpenChange}
        maskClosable={!renameLifecycle.submitting}
        keyboard={!renameLifecycle.submitting}
        closable={!renameLifecycle.submitting}
        footer={
          <Space>
            <Button onClick={renameLifecycle.requestClose} disabled={renameLifecycle.submitting}>
              取消
            </Button>
            <Button
              type="primary"
              disabled={!renameName.trim() || !basePath || !menuActionTarget || renameLifecycle.submitting}
              loading={renameLifecycle.submitting}
              onClick={() => void renameMenu()}
              {...testId(salesMenuTestIds.menuRenameSubmit)}
            >
              保存名称
            </Button>
          </Space>
        }
        {...adminDrawerSurfaceProps}
        {...testId(salesMenuTestIds.menuRenameDrawer)}
      >
        <Input
          value={renameName}
          onChange={event => {
            setRenameName(event.target.value);
            renameLifecycle.setDirty(true);
            renameLifecycle.markBusinessIntentChanged();
          }}
          placeholder="请输入菜单名称"
          autoFocus
          {...testId(salesMenuTestIds.menuRenameName)}
        />
      </Drawer>
      <Modal
        open={Boolean(sectionDialog)}
        title={sectionDialog?.kind === 'create' ? '新建销售分区' : '重命名销售分区'}
        onCancel={() => setSectionDialog(undefined)}
        maskClosable={!commands.isBusy}
        keyboard={!commands.isBusy}
        closable={!commands.isBusy}
        okText="保存"
        cancelText="取消"
        okButtonProps={{
          disabled: !sectionName.trim() || !basePath || !selectedMenu || commands.isBusy,
          ...testId(salesMenuTestIds.sectionSave),
        }}
        cancelButtonProps={{disabled: commands.isBusy}}
        confirmLoading={commands.isBusy}
        onOk={() => {
          if (!sectionDialog || !basePath || !selectedMenu || !sectionName.trim()) return;
          const operation =
            sectionDialog.kind === 'create'
              ? commands.createSection(basePath, {
                  name: sectionName.trim(),
                  expectedVersion: selectedMenu.version,
                })
              : commands.renameSection(
                  {...basePath, salesSectionRef: sectionDialog.section!.salesSectionRef},
                  {name: sectionName.trim(), expectedVersion: selectedMenu.version},
                );
          void runCommand(
            () => operation,
            sectionDialog.kind === 'create' ? '销售分区已创建。' : '销售分区名称已更新。',
            () => setSectionDialog(undefined),
          );
        }}
      >
        <Input
          value={sectionName}
          onChange={event => setSectionName(event.target.value)}
          placeholder="请输入分区名称"
          autoFocus
          {...testId(salesMenuTestIds.sectionName)}
        />
      </Modal>
      <Drawer
        open={scheduleOpen}
        title="生效与时段"
        onClose={scheduleLifecycle.requestClose}
        afterOpenChange={scheduleAfterOpenChange}
        maskClosable={!scheduleLifecycle.submitting}
        keyboard={!scheduleLifecycle.submitting}
        closable={!scheduleLifecycle.submitting}
        footer={
          <Space>
            <Button onClick={scheduleLifecycle.requestClose} disabled={scheduleLifecycle.submitting}>
              取消
            </Button>
            <Button
              type="primary"
              disabled={
                !basePath ||
                !selectedMenu ||
                (schedule.kind === 'DAILY_TIME_RANGE' && (!schedule.startLocalTime || !schedule.endLocalTime))
              }
              loading={scheduleLifecycle.submitting}
              onClick={() => void saveSchedule()}
              {...testId(salesMenuTestIds.scheduleSave)}
            >
              保存时段
            </Button>
          </Space>
        }
        {...adminDrawerSurfaceProps}
        {...testId(salesMenuTestIds.scheduleDrawer)}
      >
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          <Typography.Text>同一经营入口可以同时启用多份菜单；实际使用由销售端按自身逻辑判断。</Typography.Text>
          <Radio.Group
            value={schedule.kind}
            onChange={event => {
              setSchedule(current => ({
                ...current,
                kind: event.target.value,
                startLocalTime: event.target.value === 'ALL_DAY' ? null : current.startLocalTime,
                endLocalTime: event.target.value === 'ALL_DAY' ? null : current.endLocalTime,
              }));
              scheduleLifecycle.setDirty(true);
              scheduleLifecycle.markBusinessIntentChanged();
            }}
          >
            <Radio value="ALL_DAY" {...testId(salesMenuTestIds.scheduleKind('ALL_DAY'))}>
              全天
            </Radio>
            <Radio value="DAILY_TIME_RANGE" {...testId(salesMenuTestIds.scheduleKind('DAILY_TIME_RANGE'))}>
              每日时段
            </Radio>
          </Radio.Group>
          {schedule.kind === 'DAILY_TIME_RANGE' && (
            <Space>
              <Input
                placeholder="开始时间，如 09:00"
                value={schedule.startLocalTime ?? ''}
                onChange={event => {
                  setSchedule(current => ({...current, startLocalTime: event.target.value}));
                  scheduleLifecycle.setDirty(true);
                  scheduleLifecycle.markBusinessIntentChanged();
                }}
                {...testId(salesMenuTestIds.scheduleStart)}
              />
              <span>至</span>
              <Input
                placeholder="结束时间，如 21:00"
                value={schedule.endLocalTime ?? ''}
                onChange={event => {
                  setSchedule(current => ({...current, endLocalTime: event.target.value}));
                  scheduleLifecycle.setDirty(true);
                  scheduleLifecycle.markBusinessIntentChanged();
                }}
                {...testId(salesMenuTestIds.scheduleEnd)}
              />
            </Space>
          )}
          <Typography.Text type="secondary">当前设置：{salesMenuScheduleLabel(schedule)}</Typography.Text>
        </Space>
      </Drawer>
      <Modal
        open={Boolean(statusItem)}
        title="销售状态"
        onCancel={() => setStatusItem(undefined)}
        maskClosable={!commands.isBusy}
        keyboard={!commands.isBusy}
        closable={!commands.isBusy}
        okText={statusChoice === 'SOLD_OUT' ? '设置为沽清' : '恢复正常销售'}
        cancelText="取消"
        okButtonProps={{disabled: commands.isBusy, ...testId(salesMenuTestIds.statusSubmit)}}
        cancelButtonProps={{disabled: commands.isBusy}}
        confirmLoading={commands.isBusy}
        onOk={submitStatus}
      >
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          <Radio.Group value={statusChoice} onChange={event => setStatusChoice(event.target.value)}>
            <Radio value="NORMAL" {...testId(salesMenuTestIds.statusChoice('NORMAL'))}>
              正常销售
            </Radio>
            <Radio value="SOLD_OUT" {...testId(salesMenuTestIds.statusChoice('SOLD_OUT'))}>
              人工沽清
            </Radio>
          </Radio.Group>
          {statusChoice === 'SOLD_OUT' && (
            <Input.TextArea
              value={soldOutReason}
              onChange={event => setSoldOutReason(event.target.value)}
              placeholder="请填写人工沽清原因"
              rows={4}
              {...testId(salesMenuTestIds.statusReason)}
            />
          )}
          <Typography.Text type="secondary">库存状态是独立事实；本弹窗不能恢复库存自动不可售。</Typography.Text>
        </Space>
      </Modal>
      <Modal
        open={Boolean(confirmation)}
        title={confirmation?.title}
        onCancel={() => setConfirmation(undefined)}
        maskClosable={!commands.isBusy}
        keyboard={!commands.isBusy}
        closable={!commands.isBusy}
        okText="确认"
        cancelText="取消"
        okButtonProps={{disabled: commands.isBusy, ...testId(salesMenuTestIds.confirmationSubmit)}}
        cancelButtonProps={{disabled: commands.isBusy}}
        confirmLoading={commands.isBusy}
        onOk={() => {
          if (!confirmation) return;
          const current = confirmation;
          setConfirmation(undefined);
          void current.run();
        }}
      >
        {confirmation?.content}
      </Modal>
    </div>
  );
}
