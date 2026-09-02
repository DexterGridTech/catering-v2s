import {DeleteOutlined, DownOutlined, MoreOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Image,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
  Typography,
} from 'antd';
import type {MenuProps, TableColumnsType} from 'antd';
import {
  AdminImageCollectionEditor,
  type AdminImageCollectionItem,
  type AdminImageCollectionStatus,
  CursorPagination,
  NameCodeText,
  adminDrawerSurfaceProps,
  adminWideDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  buildCatalogNavigationCategoryTree,
  type CatalogNavigationCategory,
  type CatalogNavigationCategoryTreeNode,
} from '../../../app/api/catalogNavigationTree';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {publicRtkRequest} from '../../../app/api/generated/public-edge.rtk';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';
import type {
  SalesMenuCommandReadback,
  SalesMenuDetail,
  SalesMenuDisplayMedia,
  SalesMenuDraftItemView,
  SalesMenuItemCandidate,
  SalesMenuOperationRecord,
  SalesMenuOrderingConstraints,
  SalesMenuPublishedItemView,
  SalesMenuSchedule,
  SalesMenuSectionView,
  SalesMenuSkuPrice,
  SalesMenuSummary,
  Uuid,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageContext, OperationsPageProps} from '../../../app/routing/model';
import {
  formatSalesMenuPrice,
  salesMenuChannelStatusLabel,
  salesMenuDraftStateLabel,
  salesMenuInventoryAvailabilityLabel,
  salesMenuManualSaleStatusLabel,
  SALES_MENU_OPERATION_COLUMN_TITLE,
  salesMenuOperationLabel,
  salesMenuProductShapeLabel,
  salesMenuScheduleLabel,
  salesMenuCandidateSelection,
  type SalesMenuMode,
} from '../model/salesMenuModel';
import {useSalesMenuCommands} from '../model/useSalesMenuCommands';
import {useSalesMenuReadModel} from '../model/useSalesMenuReadModel';
import {salesMenuTestIds} from '../salesMenuTestIds';

const MEDIA_LIMITS = {maxImageCount: 6, maxImageBytes: 2 * 1024 * 1024} as const;

type SalesMenuReadModel = ReturnType<typeof useSalesMenuReadModel>;
type SalesMenuCommands = ReturnType<typeof useSalesMenuCommands>;
type DraftOrPublishedItem = SalesMenuDraftItemView | SalesMenuPublishedItemView;
type SalesMenuCategoryTreeNode = {
  title: ReactNode;
  key: string;
  children?: SalesMenuCategoryTreeNode[];
};

export function salesMenuCategoryTreeData(
  categories: readonly CatalogNavigationCategory[],
): SalesMenuCategoryTreeNode[] {
  const render = (nodes: readonly CatalogNavigationCategoryTreeNode[]): SalesMenuCategoryTreeNode[] =>
    nodes.map(({category, children}) => ({
      title: category.name,
      key: String(category.categoryRef),
      ...(children.length > 0 ? {children: render(children)} : {}),
    }));
  return render(buildCatalogNavigationCategoryTree(categories));
}

function problemMessage(error: unknown, fallback: string): string | undefined {
  if (!error) return undefined;
  return operationsProblemOf(error).detail || fallback;
}

function commandErrorMessage(error: unknown, fallback: string): string {
  return problemMessage(error, fallback) ?? fallback;
}

function formatOccurredAt(value: number): string {
  return new Date(value).toLocaleString();
}

function menuStateLabel(menu: Pick<SalesMenuDetail, 'archived' | 'draftDirty'>): string {
  if (menu.archived) return '已归档';
  return salesMenuDraftStateLabel(menu.draftDirty);
}

function saleContentLabel(item: DraftOrPublishedItem): string {
  const content = item.saleContent;
  if (content.kind === 'SKU_SELECTION') return `${content.skuPrices.length} 个规格`;
  if (content.kind === 'WEIGHTED') return `按称重数量销售 · ${content.salesUnit.name}`;
  if (content.kind === 'COMPOSITE') return `按套餐整体销售 · ${formatSalesMenuPrice(content.listedPriceCents)}`;
  return `直接销售 · ${formatSalesMenuPrice(content.listedPriceCents)}`;
}

function salesMenuSpecificationLabel(item: DraftOrPublishedItem): string {
  const content = item.saleContent;
  if (content.kind === 'SKU_SELECTION') {
    return content.skuPrices.length > 0 ? content.skuPrices.map(price => price.skuName).join('、') : '未选择规格';
  }
  if (content.kind === 'WEIGHTED') return '按称重数量';
  return '无规格';
}

function salesMenuConstraintLabel(item: DraftOrPublishedItem): string {
  if (item.saleContent.kind === 'WEIGHTED') return '不适用';
  return `起售量 ${item.orderingConstraints.minItemQuantity ?? '未设置'}；订购倍数 ${item.orderingConstraints.quantityStep ?? '未设置'}`;
}

function salesMenuPriceLabel(item: DraftOrPublishedItem): string {
  if (item.saleContent.kind === 'SKU_SELECTION') {
    return item.saleContent.skuPrices.length > 0
      ? item.saleContent.skuPrices
          .map(
            price =>
              `${price.skuName}：菜单 ${formatSalesMenuPrice(price.listedPriceCents)} / 默认 ${formatSalesMenuPrice(price.standardPriceCents)}`,
          )
          .join('；')
      : '未设置';
  }
  return formatSalesMenuPrice(item.saleContent.listedPriceCents);
}

function itemMediaLabel(item: DraftOrPublishedItem): string {
  return item.displayMedia.mode === 'INHERIT_CATALOG'
    ? '沿用商品图片'
    : `${item.displayMedia.assetRefs.length} 张菜单图片`;
}

function blockerLabel(kind: string): string {
  const labels: Record<string, string> = {
    STORE_DISABLED: '门店已停用，暂不能更新到前台。',
    CHANNEL_DISABLED: '当前经营入口已停用。',
    CHANNEL_INELIGIBLE: '当前经营入口不满足菜单条件。',
    CATALOG_ITEM_INVALID: '存在商品基础信息未通过校验。',
    SKU_SELECTION_EMPTY: '存在按规格管理商品尚未选择规格。',
    SKU_INVALID: '存在规格信息已失效。',
    LISTED_PRICE_MISSING: '存在商品尚未设置挂牌价。',
    ORDERING_CONSTRAINT_INVALID: '存在商品的起售量或订购倍数不合法。',
    DISPLAY_ASSET_PENDING_OR_INVALID: '存在菜单图片仍在处理中或不可用。',
    SCHEDULE_INVALID: '菜单时段设置不完整。',
  };
  return labels[kind] ?? '菜单还有内容未满足更新到前台的条件。';
}

function SalesMenuAssetPreview({
  assetRef,
  localFile,
  alt,
  testId: previewTestId,
}: {
  assetRef?: string;
  localFile?: File;
  alt: string;
  testId?: string;
}) {
  const [localUrl, setLocalUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!localFile) {
      setLocalUrl(undefined);
      return;
    }
    const nextUrl = URL.createObjectURL(localFile);
    setLocalUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [localFile]);
  const request = useMemo(
    () => (assetRef ? publicRtkRequest.getPublicAssetContent({assetRef: wireUuid(assetRef)}, {}) : undefined),
    [assetRef],
  );
  const assetQuery = operationsRtk.useGetPublicAssetContentQuery(request!, {
    skip: Boolean(localFile || !assetRef || !request),
  });
  useEffect(() => setFailed(false), [assetRef, localUrl, assetQuery.currentData?.publicUrl]);
  const source = localUrl ?? assetQuery.currentData?.publicUrl;
  if (!source || failed || assetQuery.isError)
    return (
      <span
        style={{width: 96, height: 72, display: 'grid', placeItems: 'center', overflow: 'hidden'}}
        role="status"
        data-testid={previewTestId}
      >
        <Typography.Text type="secondary" style={{fontSize: 12}}>
          图片不可用
        </Typography.Text>
        {assetRef && !localFile && (
          <Button size="small" type="link" onClick={() => void assetQuery.refetch()}>
            重试加载
          </Button>
        )}
      </span>
    );
  return (
    <Image
      width={96}
      height={72}
      src={source}
      alt={alt}
      preview
      style={{objectFit: 'cover'}}
      onError={() => setFailed(true)}
      data-testid={previewTestId}
    />
  );
}

type SalesMenuMediaItem = AdminImageCollectionItem & {
  assetRef?: Uuid;
  bindGrant?: string;
  version?: number;
  staged: boolean;
  error?: string;
};

function mediaItemsFromReadModel(media: SalesMenuDisplayMedia): SalesMenuMediaItem[] {
  return media.assetRefs.map(assetRef => ({
    id: String(assetRef),
    identity: String(assetRef),
    assetRef,
    fileName: '菜单图片',
    status: 'READY',
    hasPreview: true,
    staged: false,
  }));
}

function SalesMenuMediaEditor({
  item,
  menuRef,
  open,
  media,
  queryContext,
  commands,
  onChange,
  onPendingChange,
  onRegisterRelease,
}: {
  item: SalesMenuDraftItemView;
  menuRef: Uuid;
  open: boolean;
  media: SalesMenuDisplayMedia;
  queryContext: OperationsPageContext;
  commands: SalesMenuCommands;
  onChange: (next: SalesMenuDisplayMedia, bindGrants: Record<string, string>) => void;
  onPendingChange: (pending: boolean) => void;
  onRegisterRelease: (release?: () => Promise<boolean>) => void;
}) {
  const [items, setItems] = useState<SalesMenuMediaItem[]>(() => mediaItemsFromReadModel(media));
  const [bindGrants, setBindGrants] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const mediaMode = media.mode;
  const lastSessionKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    const sessionKey = `${item.salesItemRef}:${open ? 'open' : 'closed'}`;
    if (lastSessionKey.current === sessionKey) return;
    lastSessionKey.current = sessionKey;
    setItems(mediaItemsFromReadModel(item.displayMedia));
    setBindGrants({});
    setProblem(undefined);
  }, [item, open]);

  const publishChange = useCallback(
    (nextItems: SalesMenuMediaItem[], nextGrants: Record<string, string>, mode = mediaMode) => {
      setItems(nextItems);
      setBindGrants(nextGrants);
      const assetRefs = nextItems.flatMap(next => (next.assetRef ? [next.assetRef] : []));
      onChange({mode, assetRefs, primaryAssetRef: assetRefs[0] ?? null}, nextGrants);
    },
    [mediaMode, onChange],
  );

  const releaseStagedMedia = useCallback(async (): Promise<boolean> => {
    if (items.some(asset => asset.status === 'UPLOADING')) {
      setProblem('图片仍在上传或处理中，请完成或重试后再关闭。');
      return false;
    }
    const staged = items.filter(asset => asset.staged && asset.assetRef && asset.version !== undefined);
    if (staged.length === 0) return true;
    const outcomes = await Promise.all(
      staged.map(async asset => {
        try {
          await commands.release(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef: queryContext.scopeRef as Uuid,
              salesMenuRef: menuRef,
              salesItemRef: item.salesItemRef,
              assetRef: asset.assetRef as Uuid,
            },
            {expectedAssetVersion: asset.version as number},
          );
          return {asset, released: true};
        } catch (error) {
          setProblem(commandErrorMessage(error, '图片资产释放未完成，请重试关闭。'));
          return {asset, released: false};
        }
      }),
    );
    const releasedIds = new Set(outcomes.filter(outcome => outcome.released).map(outcome => outcome.asset.id));
    if (releasedIds.size > 0) {
      const nextItems = items.filter(asset => !releasedIds.has(asset.id));
      const nextGrants = Object.fromEntries(
        Object.entries(bindGrants).filter(([assetRef]) =>
          nextItems.some(asset => asset.assetRef && String(asset.assetRef) === assetRef && asset.staged),
        ),
      );
      publishChange(nextItems, nextGrants);
    }
    return outcomes.every(outcome => outcome.released);
  }, [bindGrants, commands, item.salesItemRef, items, menuRef, publishChange, queryContext]);

  useEffect(() => {
    onRegisterRelease(releaseStagedMedia);
    return () => onRegisterRelease(undefined);
  }, [onRegisterRelease, releaseStagedMedia]);

  const stageMedia = useCallback(
    async (file: File, existingId?: string) => {
      setProblem(undefined);
      if (file.size > MEDIA_LIMITS.maxImageBytes) {
        setProblem('单张图片不能超过 2MB。');
        return;
      }
      if (!existingId && items.length >= MEDIA_LIMITS.maxImageCount) {
        setProblem('最多维护 6 张图片（1 张主图 + 5 张附图）。');
        return;
      }
      const id = existingId ?? `pending-${file.name}-${Date.now()}`;
      const placeholder: SalesMenuMediaItem = {
        id,
        identity: existingId ?? id,
        assetRef: existingId ? items.find(current => current.id === existingId)?.assetRef : undefined,
        version: existingId ? items.find(current => current.id === existingId)?.version : undefined,
        bindGrant: existingId ? items.find(current => current.id === existingId)?.bindGrant : undefined,
        fileName: file.name,
        status: 'UPLOADING',
        file,
        hasPreview: true,
        staged: true,
      };
      const before = items;
      const optimistic = existingId
        ? before.map(current => (current.id === existingId ? placeholder : current))
        : [...before, placeholder];
      setItems(optimistic);
      onPendingChange(true);
      try {
        const response = await commands.stage(
          {
            groupWorkspaceKey: queryContext.groupWorkspaceKey,
            storeRef: queryContext.scopeRef as Uuid,
            salesMenuRef: menuRef,
            salesItemRef: item.salesItemRef,
          },
          file,
          item.version,
        );
        const nextItem: SalesMenuMediaItem = {
          ...placeholder,
          id: String(response.assetRef),
          identity: String(response.assetRef),
          assetRef: response.assetRef,
          version: response.version,
          status: 'READY',
          hasPreview: true,
          staged: true,
          bindGrant: response.bindGrant,
          error: undefined,
        };
        const previousStaged =
          existingId && placeholder.assetRef && placeholder.version !== undefined && placeholder.staged
            ? placeholder
            : undefined;
        if (previousStaged) {
          try {
            await commands.release(
              {
                groupWorkspaceKey: queryContext.groupWorkspaceKey,
                storeRef: queryContext.scopeRef as Uuid,
                salesMenuRef: menuRef,
                salesItemRef: item.salesItemRef,
                assetRef: previousStaged.assetRef as Uuid,
              },
              {expectedAssetVersion: previousStaged.version as number},
            );
          } catch (error) {
            let replacementReleased = false;
            try {
              await commands.release(
                {
                  groupWorkspaceKey: queryContext.groupWorkspaceKey,
                  storeRef: queryContext.scopeRef as Uuid,
                  salesMenuRef: menuRef,
                  salesItemRef: item.salesItemRef,
                  assetRef: response.assetRef,
                },
                {expectedAssetVersion: response.version},
              );
              replacementReleased = true;
            } catch {
              // Keep the original failure visible; the next user action must
              // still be able to retry the authoritative release.
            }
            setItems(current => {
              const restored = current.map(currentItem => (currentItem.id === id ? previousStaged : currentItem));
              return replacementReleased ? restored : [...restored, nextItem];
            });
            if (!replacementReleased) {
              setBindGrants(current => ({...current, [String(response.assetRef)]: response.bindGrant}));
            }
            setProblem(commandErrorMessage(error, '替换前的暂存图片释放未完成，请重试。'));
            return;
          }
        }
        const nextItems = optimistic.map(current => (current.id === id ? nextItem : current));
        const nextGrants = {...bindGrants, [String(response.assetRef)]: response.bindGrant};
        if (existingId && placeholder.assetRef) delete nextGrants[String(placeholder.assetRef)];
        publishChange(nextItems, nextGrants);
      } catch (error) {
        const failed = optimistic.map(current =>
          current.id === id
            ? {...current, status: 'FAILED' as AdminImageCollectionStatus, error: '上传失败，请重试。'}
            : current,
        );
        setItems(failed);
        setProblem(commandErrorMessage(error, '图片上传失败，请重试。'));
      } finally {
        onPendingChange(false);
      }
    },
    [bindGrants, commands, item, items, menuRef, onPendingChange, publishChange, queryContext],
  );

  const removeMedia = useCallback(
    async (id: string, index: number) => {
      if (index === 0 && items.length > 1) return;
      const removed = items.find(current => current.id === id);
      if (removed?.staged && removed.assetRef && removed.version !== undefined) {
        try {
          await commands.release(
            {
              groupWorkspaceKey: queryContext.groupWorkspaceKey,
              storeRef: queryContext.scopeRef as Uuid,
              salesMenuRef: menuRef,
              salesItemRef: item.salesItemRef,
              assetRef: removed.assetRef,
            },
            {expectedAssetVersion: removed.version},
          );
        } catch (error) {
          setProblem(commandErrorMessage(error, '图片资产释放未完成，请重试。'));
          return;
        }
      }
      const nextItems = items.filter(current => current.id !== id);
      const nextGrants = {...bindGrants};
      if (removed?.assetRef) delete nextGrants[String(removed.assetRef)];
      publishChange(nextItems, nextGrants);
    },
    [bindGrants, commands, item.salesItemRef, items, menuRef, publishChange, queryContext],
  );

  const moveMedia = useCallback(
    (id: string, offset: -1 | 1) => {
      const index = items.findIndex(current => current.id === id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
      const nextItems = [...items];
      const [moved] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, moved);
      publishChange(nextItems, bindGrants);
    },
    [bindGrants, items, publishChange],
  );

  const setPrimary = useCallback(
    (id: string) => {
      const index = items.findIndex(current => current.id === id);
      if (index <= 0) return;
      const nextItems = [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
      publishChange(nextItems, bindGrants);
    },
    [bindGrants, items, publishChange],
  );

  return (
    <Space direction="vertical" size={10} style={{display: 'flex'}}>
      <Radio.Group
        value={mediaMode}
        onChange={event => {
          const nextMode = event.target.value as SalesMenuDisplayMedia['mode'];
          publishChange(nextMode === 'CUSTOM' ? items : [], bindGrants, nextMode);
        }}
        {...testId(salesMenuTestIds.itemMediaMode)}
      >
        <Radio value="INHERIT_CATALOG">沿用商品图片</Radio>
        <Radio value="CUSTOM">单独设置</Radio>
      </Radio.Group>
      {mediaMode === 'INHERIT_CATALOG' ? (
        <Typography.Text type="secondary">预览使用商品当前主图；菜单不会复制出另一份图片。</Typography.Text>
      ) : (
        <>
          {problem && <Alert type="error" showIcon title={problem} />}
          <AdminImageCollectionEditor
            items={items}
            limits={MEDIA_LIMITS}
            labels={{
              title: '展示图片',
              formatLimits: count => `${count}/6（1 张主图 + 5 张附图） · 单张上限 2MB`,
              loading: '媒体规则加载中',
              atLimit: '已达图片上限',
              upload: '上传图片',
              empty: '未配置图片',
              pendingPreview: asset => (
                <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                  <Typography.Text type="secondary">
                    {asset.status === 'FAILED' ? '图片上传失败' : '待上传'}
                  </Typography.Text>
                </span>
              ),
              renderPreview: (asset, index, previewId) => (
                <SalesMenuAssetPreview
                  assetRef={asset.assetRef}
                  localFile={asset.file}
                  alt={`${index === 0 ? '主图' : `附图 ${index}`}预览`}
                  testId={previewId}
                />
              ),
              renderStatus: asset =>
                asset.status === 'UPLOADING'
                  ? '上传中/处理中'
                  : asset.status === 'FAILED'
                    ? (asset.error ?? '上传失败')
                    : asset.staged
                      ? '待保存'
                      : '可用',
              positionLabel: index => (index === 0 ? '★ 主图' : `附图 ${index}`),
              replace: '替换',
              retry: '重试',
              moveUp: '上移',
              moveDown: '下移',
              setPrimary: '设为主图',
              remove: '移除',
            }}
            testIds={{
              root: salesMenuTestIds.itemMediaEditor,
              upload: salesMenuTestIds.itemMediaUpload,
              list: salesMenuTestIds.itemMediaList,
              item: salesMenuTestIds.itemMedia,
            }}
            onStageMedia={stageMedia}
            onRemoveMedia={removeMedia}
            onMoveMedia={moveMedia}
            onSetPrimaryMedia={setPrimary}
          />
        </>
      )}
    </Space>
  );
}

function SalesMenuItemDetailDrawer({
  item,
  open,
  onClose,
}: {
  item?: DraftOrPublishedItem;
  open: boolean;
  onClose: () => void;
}) {
  const published = item && 'inventoryAvailability' in item;
  return (
    <Drawer
      open={open}
      title="销售项详情"
      onClose={onClose}
      maskClosable
      width="min(720px, calc(100vw - 48px))"
      {...adminDrawerSurfaceProps}
      {...testId(salesMenuTestIds.itemDetail)}
    >
      {item && (
        <Space direction="vertical" size={16} style={{display: 'flex'}}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="菜单商品">
              <NameCodeText name={item.displayName} code={item.itemCode} />
            </Descriptions.Item>
            <Descriptions.Item label="商品形态">{salesMenuProductShapeLabel(item.productShape)}</Descriptions.Item>
            <Descriptions.Item label="销售内容">{saleContentLabel(item)}</Descriptions.Item>
            <Descriptions.Item label="适用挂牌价">
              {item.saleContent.kind === 'SKU_SELECTION'
                ? '按规格分别设置'
                : formatSalesMenuPrice(item.saleContent.listedPriceCents)}
            </Descriptions.Item>
            <Descriptions.Item label="适用约束">
              {item.saleContent.kind === 'WEIGHTED'
                ? '称重销售不显示按份约束'
                : `起售量 ${item.orderingConstraints.minItemQuantity ?? '未设置'}；订购倍数 ${item.orderingConstraints.quantityStep ?? '未设置'}`}
            </Descriptions.Item>
            <Descriptions.Item label="展示图片">{itemMediaLabel(item)}</Descriptions.Item>
          </Descriptions>
          {item.saleContent.kind === 'SKU_SELECTION' && (
            <Card size="small" title="规格与挂牌价">
              <Table<SalesMenuSkuPrice>
                size="small"
                rowKey="skuRef"
                pagination={false}
                dataSource={item.saleContent.skuPrices}
                columns={[
                  {title: '规格', dataIndex: 'skuName', key: 'skuName'},
                  {title: '规格编码', dataIndex: 'skuCode', key: 'skuCode'},
                  {
                    title: '商品默认价',
                    key: 'standardPrice',
                    render: (_, row) => formatSalesMenuPrice(row.standardPriceCents),
                  },
                  {
                    title: '菜单挂牌价',
                    key: 'listedPrice',
                    render: (_, row) => formatSalesMenuPrice(row.listedPriceCents),
                  },
                ]}
              />
            </Card>
          )}
          {item.saleContent.kind === 'WEIGHTED' && (
            <Card size="small" title="销售单位">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="单位">
                  <NameCodeText name={item.saleContent.salesUnit.name} code={item.saleContent.salesUnit.code} />
                </Descriptions.Item>
                <Descriptions.Item label="精度">{item.saleContent.salesUnit.precision}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
          {published && (
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card size="small" title="库存状态">
                  {salesMenuInventoryAvailabilityLabel(item.inventoryAvailability)}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="销售状态">
                  {salesMenuManualSaleStatusLabel(item.manualSaleStatus)}
                </Card>
              </Col>
            </Row>
          )}
        </Space>
      )}
    </Drawer>
  );
}

function SalesMenuItemEditorDrawer({
  item,
  open,
  queryContext,
  menuRef,
  commands,
  onSave,
  onClose,
  onSaved,
  onDelete,
  onClosedFocus,
}: {
  item?: SalesMenuDraftItemView;
  open: boolean;
  queryContext: OperationsPageContext;
  menuRef?: Uuid;
  commands: SalesMenuCommands;
  onSave: (
    item: SalesMenuDraftItemView,
    body: Parameters<SalesMenuCommands['updateItem']>[1],
    grants: Record<string, string>,
  ) => Promise<boolean>;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (item: SalesMenuDraftItemView, beforeDelete?: () => Promise<boolean>) => void;
  onClosedFocus: () => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [listedPriceCents, setListedPriceCents] = useState<number | null>(null);
  const [skuPrices, setSkuPrices] = useState<SalesMenuSkuPrice[]>([]);
  const [constraints, setConstraints] = useState<SalesMenuOrderingConstraints>({
    minItemQuantity: null,
    quantityStep: null,
  });
  const [displayMedia, setDisplayMedia] = useState<SalesMenuDisplayMedia>({
    mode: 'INHERIT_CATALOG',
    assetRefs: [],
    primaryAssetRef: null,
  });
  const [assetBindGrants, setAssetBindGrants] = useState<Record<string, string>>({});
  const [mediaPending, setMediaPending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const stagedReleaseRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));
  const closingAfterSaveRef = useRef(false);
  const closeInFlightRef = useRef(false);
  const openedRef = useRef(false);
  const lifecycleRef = useRef<{
    reset: () => void;
    setDirty: (dirty: boolean) => void;
  } | null>(null);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: nextOpen => {
      if (nextOpen) return;
      if (closingAfterSaveRef.current) {
        closingAfterSaveRef.current = false;
        onClose();
        return;
      }
      if (closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      setClosing(true);
      lifecycle.setSubmitting(true);
      void stagedReleaseRef
        .current()
        .then(released => {
          if (released) {
            onClose();
            return;
          }
          lifecycleRef.current?.reset();
          lifecycleRef.current?.setDirty(true);
        })
        .finally(() => {
          lifecycle.setSubmitting(false);
          closeInFlightRef.current = false;
          setClosing(false);
        });
    },
    dirtyMessage: '已填写的内容不会保存。',
    onSuccessClosed: onSaved,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsSalesMenuItem,
    idempotencyKey: true,
  });
  lifecycleRef.current = lifecycle;
  const resetLifecycle = lifecycle.reset;

  useEffect(() => {
    if (!item || !open) return;
    openedRef.current = true;
    setDisplayName(item.displayName);
    setListedPriceCents(item.saleContent.listedPriceCents);
    setSkuPrices(item.saleContent.skuPrices);
    setConstraints(item.orderingConstraints);
    setDisplayMedia(item.displayMedia);
    setAssetBindGrants({});
    setMediaPending(false);
    setProblem(undefined);
    setClosing(false);
    closeInFlightRef.current = false;
    closingAfterSaveRef.current = false;
    resetLifecycle();
  }, [item, open, resetLifecycle]);

  const markDirty = useCallback(() => {
    lifecycle.setDirty(true);
    lifecycle.markBusinessIntentChanged();
  }, [lifecycle]);

  const handleMediaPendingChange = useCallback(
    (pending: boolean) => {
      setMediaPending(pending);
      lifecycle.setSubmitting(pending);
      if (pending) markDirty();
    },
    [lifecycle, markDirty],
  );

  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      lifecycle.afterOpenChange(visible);
      if (!visible && openedRef.current) {
        openedRef.current = false;
        window.requestAnimationFrame(onClosedFocus);
      }
    },
    [lifecycle, onClosedFocus],
  );

  const registerStagedRelease = useCallback((release?: () => Promise<boolean>) => {
    stagedReleaseRef.current = release ?? (() => Promise.resolve(true));
  }, []);

  const save = useCallback(async () => {
    if (!item || !menuRef || mediaPending) return;
    setProblem(undefined);
    setSaving(true);
    lifecycle.setSubmitting(true);
    const isSku = item.saleContent.kind === 'SKU_SELECTION';
    try {
      const saved = await onSave(
        item,
        {
          displayNameOverride: displayName.trim() ? displayName.trim() : null,
          saleContent: {
            kind: item.saleContent.kind,
            listedPriceCents: isSku ? null : listedPriceCents,
            skuPrices: isSku ? skuPrices : [],
          },
          orderingConstraints:
            item.saleContent.kind === 'WEIGHTED' ? {minItemQuantity: null, quantityStep: null} : constraints,
          displayMedia,
          expectedVersion: item.version,
        },
        assetBindGrants,
      );
      if (!saved) {
        lifecycle.setSubmitting(false);
        return;
      }
      closingAfterSaveRef.current = true;
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setProblem(commandErrorMessage(error, '销售项保存失败，请检查后重试。'));
      lifecycle.setSubmitting(false);
    } finally {
      setSaving(false);
    }
  }, [
    assetBindGrants,
    constraints,
    displayMedia,
    displayName,
    item,
    lifecycle,
    listedPriceCents,
    mediaPending,
    menuRef,
    onSave,
    skuPrices,
  ]);

  if (!item) return null;
  const isSku = item.saleContent.kind === 'SKU_SELECTION';
  const isWeighted = item.saleContent.kind === 'WEIGHTED';
  return (
    <Drawer
      open={open}
      title={
        <Space>
          <span>编辑销售项</span>
          <Tag>{salesMenuProductShapeLabel(item.productShape)}</Tag>
        </Space>
      }
      closable={false}
      onClose={lifecycle.requestClose}
      afterOpenChange={handleAfterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      extra={
        <Space>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(item, stagedReleaseRef.current)}
            disabled={saving || closing}
          >
            删除销售项
          </Button>
          <Button onClick={lifecycle.requestClose} disabled={saving || closing}>
            关闭
          </Button>
        </Space>
      }
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={saving || closing}>
            取消
          </Button>
          <Button type="primary" onClick={() => void save()} loading={saving} disabled={mediaPending || closing}>
            保存
          </Button>
        </Space>
      }
      {...testId(salesMenuTestIds.itemEditor)}
      {...adminWideDrawerSurfaceProps}
    >
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {problem && <Alert type="error" showIcon title={problem} />}
        <Card size="small" title="菜单展示名称">
          <Input
            value={displayName}
            placeholder="留空则沿用商品名称"
            onChange={event => {
              setDisplayName(event.target.value);
              markDirty();
            }}
            {...testId(salesMenuTestIds.itemDisplayName)}
          />
        </Card>
        <Card size="small" title="销售内容与挂牌价">
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            <Typography.Text type="secondary">
              {item.saleContent.kind === 'SKU_SELECTION'
                ? '按规格销售；每个规格分别维护菜单挂牌价。'
                : item.saleContent.kind === 'WEIGHTED'
                  ? '按称重数量销售；销售单位来自商品结构化事实。'
                  : item.saleContent.kind === 'COMPOSITE'
                    ? '当前按套餐整体销售。'
                    : '该商品无规格，直接销售该商品。'}
            </Typography.Text>
            {isSku ? (
              <Table<SalesMenuSkuPrice>
                size="small"
                rowKey="skuRef"
                pagination={false}
                dataSource={skuPrices}
                columns={[
                  {title: '规格', dataIndex: 'skuName', key: 'skuName'},
                  {title: '规格编码', dataIndex: 'skuCode', key: 'skuCode'},
                  {
                    title: '商品默认价',
                    key: 'standardPrice',
                    render: (_, row) => formatSalesMenuPrice(row.standardPriceCents),
                  },
                  {
                    title: '菜单挂牌价',
                    key: 'listedPrice',
                    render: (_, row) => (
                      <InputNumber
                        min={0}
                        precision={2}
                        value={row.listedPriceCents / 100}
                        addonBefore="¥"
                        onChange={value => {
                          const nextCents = value === null || value === undefined ? 0 : Math.round(value * 100);
                          setSkuPrices(current =>
                            current.map(price =>
                              price.skuRef === row.skuRef ? {...price, listedPriceCents: nextCents} : price,
                            ),
                          );
                          markDirty();
                        }}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <Space direction="vertical" size={4} style={{display: 'flex'}}>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="商品默认价">
                    {formatSalesMenuPrice(item.defaultPriceCents)}
                  </Descriptions.Item>
                </Descriptions>
                <Typography.Text strong>挂牌价</Typography.Text>
                <InputNumber
                  min={0}
                  precision={2}
                  addonBefore="¥"
                  value={listedPriceCents === null ? undefined : listedPriceCents / 100}
                  onChange={value => {
                    setListedPriceCents(value === null || value === undefined ? null : Math.round(value * 100));
                    markDirty();
                  }}
                  {...testId(salesMenuTestIds.itemListedPrice)}
                />
                {isWeighted && (
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="销售单位">
                      <NameCodeText name={item.saleContent.salesUnit.name} code={item.saleContent.salesUnit.code} />
                    </Descriptions.Item>
                    <Descriptions.Item label="精度">{item.saleContent.salesUnit.precision}</Descriptions.Item>
                  </Descriptions>
                )}
              </Space>
            )}
          </Space>
        </Card>
        <Card size="small" title="适用约束">
          {isWeighted ? (
            <Typography.Text type="secondary">称重销售商品不显示按份定义的起售量与订购倍数。</Typography.Text>
          ) : (
            <Space>
              <label>
                起售量
                <InputNumber
                  min={1}
                  value={constraints.minItemQuantity ?? undefined}
                  onChange={value => {
                    setConstraints(current => ({...current, minItemQuantity: value ?? null}));
                    markDirty();
                  }}
                />
              </label>
              <label>
                订购倍数
                <InputNumber
                  min={1}
                  value={constraints.quantityStep ?? undefined}
                  onChange={value => {
                    setConstraints(current => ({...current, quantityStep: value ?? null}));
                    markDirty();
                  }}
                />
              </label>
            </Space>
          )}
        </Card>
        <Divider />
        <Card size="small" title="展示图片">
          <SalesMenuMediaEditor
            item={item}
            menuRef={menuRef as Uuid}
            open={open}
            media={displayMedia}
            queryContext={queryContext}
            commands={commands}
            onChange={(next, grants) => {
              setDisplayMedia(next);
              setAssetBindGrants(grants);
              markDirty();
            }}
            onPendingChange={handleMediaPendingChange}
            onRegisterRelease={registerStagedRelease}
          />
        </Card>
      </Space>
    </Drawer>
  );
}

function SalesMenuCandidateDrawer({
  open,
  read,
  onClose,
  onAdd,
  onClosedFocus,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onAdd: (refs: Uuid[]) => Promise<boolean>;
  onClosedFocus: () => void;
}) {
  const [selected, setSelected] = useState<Uuid[]>([]);
  const openedRef = useRef(false);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已选择的商品尚未加入菜单。',
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsSalesMenuItemCandidates,
  });
  const resetLifecycle = lifecycle.reset;
  const categoryNavigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: wireUuid(read.storeRef ?? ''), viewKey: 'ALL'}},
      ),
    [read.storeRef],
  );
  const categoryNavigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(categoryNavigationRequest, {
    skip: !open || !read.storeRef,
  });
  const categoryNavigation = categoryNavigationQuery.currentData?.data;
  const categoryTreeData = useMemo(
    () => salesMenuCategoryTreeData(categoryNavigation?.tree ?? []),
    [categoryNavigation?.tree],
  );
  useEffect(() => {
    setSelected([]);
    resetLifecycle();
  }, [open, resetLifecycle]);
  const page = read.candidates.page;
  const rows = useMemo(() => page?.items ?? [], [page?.items]);
  const selection = useMemo(
    () =>
      salesMenuCandidateSelection(
        selected,
        rows.map(row => row.candidateRef),
      ),
    [rows, selected],
  );
  const hiddenSelectedCount = selection.hiddenSelectedCount;
  const error = problemMessage(read.candidates.query.error, '商品候选暂时无法获取，请重试。');
  const categoryError = problemMessage(categoryNavigationQuery.error, '商品分类暂时无法读取，请重试。');
  const submit = useCallback(async () => {
    if (!selection.canSubmit || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    const added = await onAdd(selected);
    if (added) lifecycle.closeAfterSuccess();
    else lifecycle.setSubmitting(false);
  }, [lifecycle, onAdd, selected, selection.canSubmit]);
  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      lifecycle.afterOpenChange(visible);
      if (visible) {
        openedRef.current = true;
        return;
      }
      if (openedRef.current && !open) {
        openedRef.current = false;
        window.requestAnimationFrame(onClosedFocus);
      }
    },
    [lifecycle, onClosedFocus, open],
  );
  return (
    <Drawer
      open={open}
      title="添加商品到菜单"
      onClose={lifecycle.requestClose}
      afterOpenChange={handleAfterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      width="min(860px, calc(100vw - 48px))"
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            disabled={!selection.canSubmit}
            loading={lifecycle.submitting}
            onClick={() => void submit()}
          >
            添加已选商品
          </Button>
        </Space>
      }
      {...testId(salesMenuTestIds.candidateDrawer)}
    >
      <Row gutter={[16, 16]} align="top">
        <Col xs={24} md={7}>
          <Card size="small" title="商品分类" bodyStyle={{maxHeight: 560, overflowY: 'auto'}}>
            {categoryError && <Alert type="error" showIcon title={categoryError} />}
            {!categoryError && categoryNavigationQuery.isLoading && <Spin />}
            {!categoryError && !categoryNavigationQuery.isLoading && (
              <Tree
                blockNode
                showLine
                aria-label="商品分类树"
                treeData={categoryTreeData}
                selectedKeys={read.candidateCategoryRef ? [read.candidateCategoryRef] : []}
                onSelect={keys => {
                  const next = String(keys[0] ?? '');
                  read.setCandidateCategoryRef(next ? (next as Uuid) : undefined);
                  read.candidates.cursor.reset();
                }}
                {...testId(salesMenuTestIds.candidateCategoryTree)}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={17}>
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            <Input.Search
              value={read.candidateQuery}
              allowClear
              placeholder="搜索商品名称或编码"
              onChange={event => {
                read.setCandidateQuery(event.target.value);
                read.candidates.cursor.reset();
              }}
              onSearch={() => read.candidates.cursor.reset()}
            />
            <Typography.Text type="secondary">分类只用于查找商品；候选商品按商品形态展示。</Typography.Text>
            {hiddenSelectedCount > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`当前还有 ${hiddenSelectedCount} 个已选商品不在本页；请返回其所在结果页，或清除不可见选择后再提交。`}
                action={
                  <Button
                    size="small"
                    onClick={() => {
                      setSelected(selection.visibleSelected as Uuid[]);
                      lifecycle.setDirty(false);
                    }}
                  >
                    清除不可见选择
                  </Button>
                }
              />
            )}
            {error && (
              <Alert
                type="error"
                showIcon
                title={error}
                action={<Button onClick={() => void read.candidates.query.refetch()}>重试</Button>}
              />
            )}
            <Table<SalesMenuItemCandidate>
              size="small"
              rowKey="candidateRef"
              loading={read.candidates.query.isFetching}
              dataSource={rows}
              rowSelection={{
                selectedRowKeys: selected,
                onChange: keys => {
                  const next = keys as Uuid[];
                  setSelected(next);
                  lifecycle.setDirty(next.length > 0);
                  lifecycle.markBusinessIntentChanged();
                },
              }}
              pagination={false}
              locale={{emptyText: '该分类暂无可编入商品'}}
              columns={[
                {title: '商品名称', dataIndex: 'displayName', key: 'displayName'},
                {title: '商品编码', dataIndex: 'itemCode', key: 'itemCode'},
                {
                  title: '中文商品形态',
                  key: 'productShape',
                  render: (_, row) => salesMenuProductShapeLabel(row.productShape),
                },
                {
                  title: '所属分类',
                  key: 'categoryNames',
                  render: (_, row) => (row.categoryNames.length > 0 ? row.categoryNames.join(' / ') : '未分类'),
                },
                {
                  title: '默认价格',
                  key: 'defaultPriceCents',
                  render: (_, row) => formatSalesMenuPrice(row.defaultPriceCents),
                },
                {title: '已编入次数', dataIndex: 'alreadyAddedCount', key: 'alreadyAddedCount'},
              ]}
            />
            <CursorPagination
              state={read.candidates.cursor}
              nextCursor={page?.nextCursor ?? undefined}
              testIdPrefix={salesMenuTestIds.candidateCursor}
            />
          </Space>
        </Col>
      </Row>
    </Drawer>
  );
}

function SalesMenuManagerDrawer({
  open,
  read,
  onClose,
  onSelect,
  onToggle,
  canEdit,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onSelect: (menu: SalesMenuDetail | SalesMenuSummary) => void;
  onToggle: (menu: SalesMenuSummary) => void;
  canEdit: boolean;
}) {
  const page = read.manager.page;
  const rows = page?.items ?? [];
  return (
    <Drawer
      open={open}
      title="管理菜单"
      onClose={onClose}
      maskClosable
      {...adminWideDrawerSurfaceProps}
      width="min(880px, calc(100vw - 48px))"
      {...testId(salesMenuTestIds.menuManager)}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Input.Search
          value={read.managerQuery}
          allowClear
          placeholder="搜索菜单名称"
          onChange={event => {
            read.setManagerQuery(event.target.value);
            read.manager.cursor.reset();
          }}
          onSearch={() => read.manager.cursor.reset()}
        />
        <Table<SalesMenuSummary>
          size="small"
          rowKey="salesMenuRef"
          loading={read.manager.query.isFetching}
          dataSource={rows}
          pagination={false}
          locale={{emptyText: '暂无菜单'}}
          columns={[
            {
              title: '菜单名称',
              key: 'name',
              render: (_, row) => (
                <Button type="link" onClick={() => onSelect(row)} style={{padding: 0}}>
                  {row.name}
                </Button>
              ),
            },
            {title: '菜单状态', key: 'state', render: (_, row) => menuStateLabel(row)},
            {
              title: '经营入口',
              key: 'activation',
              render: (_, row) => salesMenuChannelStatusLabel(row.activation?.status ?? 'DISABLED'),
            },
            {
              title: '启停',
              key: 'toggle',
              render: (_, row) => (
                <Button type="link" disabled={!canEdit || row.archived} onClick={() => onToggle(row)}>
                  {row.activation?.status === 'ENABLED' ? '停用' : '启用'}
                </Button>
              ),
            },
          ]}
        />
        <CursorPagination
          state={read.manager.cursor}
          nextCursor={page?.nextCursor ?? undefined}
          testIdPrefix={salesMenuTestIds.managerCursor}
        />
      </Space>
    </Drawer>
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
        <Button type="link" icon={<PlusOutlined />} onClick={onCreate} disabled={!canEdit}>
          新建分区
        </Button>
      }
      {...testId(salesMenuTestIds.sectionList)}
    >
      <Space direction="vertical" size={4} style={{display: 'flex'}}>
        {rows.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无销售分区" />}
        {rows.map(section => {
          const menuItems: MenuProps['items'] = [
            {key: 'rename', label: '重命名', disabled: !canEdit},
            {key: 'up', label: '上移', disabled: !canEdit || !section.canMoveUp},
            {key: 'down', label: '下移', disabled: !canEdit || !section.canMoveDown},
            {type: 'divider'},
            {key: 'delete', label: '删除分区', danger: true, disabled: !canEdit},
          ];
          return (
            <div
              key={section.salesSectionRef}
              style={{display: 'flex', alignItems: 'center', gap: 4}}
              {...testId(salesMenuTestIds.section(section.salesSectionRef))}
            >
              <Button
                type={read.selectedSectionRef === section.salesSectionRef ? 'primary' : 'text'}
                onClick={() => read.setSelectedSectionRef(section.salesSectionRef)}
                style={{flex: 1, textAlign: 'left'}}
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
                <Button type="text" icon={<MoreOutlined />} aria-label="更多分区操作" />
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
      width: 280,
      render: (_, row) => (
        <Space align="start" size={8}>
          {row.displayMedia.mode === 'CUSTOM' && row.displayMedia.primaryAssetRef ? (
            <SalesMenuAssetPreview
              assetRef={row.displayMedia.primaryAssetRef}
              alt={`${row.displayName}展示图`}
            />
          ) : (
            <span
              style={{width: 96, height: 72, display: 'grid', placeItems: 'center', background: '#f5f5f5'}}
              aria-label="沿用商品图片"
            >
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                沿用商品图片
              </Typography.Text>
            </span>
          )}
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              style={{padding: 0, height: 'auto'}}
              onClick={event => onEdit(row, event.currentTarget)}
              {...testId(salesMenuTestIds.item(row.salesItemRef))}
            >
              <NameCodeText name={row.displayName} code={row.itemCode} emphasizeName />
            </Button>
          </Space>
        </Space>
      ),
    },
    {
      title: '商品形态',
      key: 'productShape',
      width: 150,
      render: (_, row) => salesMenuProductShapeLabel(row.productShape),
    },
    {title: '销售规格', key: 'saleContent', width: 180, render: (_, row) => salesMenuSpecificationLabel(row)},
    {title: '挂牌价', key: 'price', width: 320, render: (_, row) => salesMenuPriceLabel(row)},
    {title: '销售约束', key: 'constraints', width: 220, render: (_, row) => salesMenuConstraintLabel(row)},
    {
      title: SALES_MENU_OPERATION_COLUMN_TITLE,
      key: 'actions',
      fixed: 'right',
      width: 72,
      render: (_, row) => (
        <Dropdown
          menu={{
            items: [
              {key: 'up', label: '上移', disabled: !canEdit || !row.canMoveUp},
              {key: 'down', label: '下移', disabled: !canEdit || !row.canMoveDown},
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
          rowKey="salesItemRef"
          loading={read.draftItems.query.isFetching}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{x: 1400}}
          locale={{emptyText: '该分区暂无菜单商品'}}
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
      width: 220,
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
        </Space>
      ),
    },
    {
      title: '商品形态',
      key: 'productShape',
      width: 150,
      render: (_, row) => salesMenuProductShapeLabel(row.productShape),
    },
    {title: '销售规格', key: 'saleContent', width: 220, render: (_, row) => saleContentLabel(row)},
    {
      title: '挂牌价',
      key: 'price',
      width: 120,
      render: (_, row) =>
        row.saleContent.kind === 'SKU_SELECTION'
          ? '按规格分别设置'
          : formatSalesMenuPrice(row.saleContent.listedPriceCents),
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
        <Button type="link" onClick={() => onStatus(row)}>
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
          rowKey="salesItemRef"
          loading={read.publishedItems.query.isFetching}
          dataSource={rows}
          columns={columns}
          pagination={false}
          scroll={{x: 1050}}
          locale={{emptyText: '该分区暂无菜单商品'}}
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
          loading={read.operationRecords.query.isFetching}
          dataSource={rows}
          columns={columns}
          pagination={false}
          locale={{emptyText: '暂无操作记录'}}
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

function PublishDrawer({
  open,
  read,
  onClose,
  onPublish,
  canEdit,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onPublish: () => void;
  canEdit: boolean;
}) {
  const preview = read.publicationPreview.page;
  return (
    <Drawer
      open={open}
      title="更新到前台"
      onClose={onClose}
      maskClosable
      width="min(620px, calc(100vw - 48px))"
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            onClick={onPublish}
            disabled={!canEdit || !preview || !preview.hasChanges || preview.violations.length > 0}
          >
            更新到前台
          </Button>
        </Space>
      }
      {...adminDrawerSurfaceProps}
      {...testId(salesMenuTestIds.publishDrawer)}
    >
      {read.publicationPreview.query.isFetching && <Spin />}
      {read.publicationPreview.query.error && (
        <Alert
          type="error"
          showIcon
          title="发布预检暂时无法获取，请重试。"
          action={<Button onClick={() => void read.publicationPreview.query.refetch()}>重试</Button>}
        />
      )}
      {preview && (
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          {!preview.hasChanges && <Alert type="info" showIcon title="当前没有未发布修改。" />}
          {preview.violations.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title="菜单还有内容未满足更新到前台的条件。"
              description={
                <Space direction="vertical" size={4}>
                  {preview.violations.map((violation, index) => (
                    <span key={`${violation.kind}-${violation.salesItemRef ?? index}`}>
                      {blockerLabel(violation.kind)}
                    </span>
                  ))}
                </Space>
              }
            />
          )}
          {preview.hasChanges && preview.violations.length === 0 && (
            <Alert type="success" showIcon title="当前草稿可以更新到前台。" />
          )}
        </Space>
      )}
    </Drawer>
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
  const [statusChoice, setStatusChoice] = useState<'NORMAL' | 'SOLD_OUT'>('NORMAL');
  const [soldOutReason, setSoldOutReason] = useState('');
  const [confirmation, setConfirmation] = useState<{title: string; content: ReactNode; run: () => Promise<void>}>();

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
        read.refresh();
        after?.(result);
        setFeedback({type: 'success', message: success});
        return true;
      } catch (error) {
        setFeedback({type: 'error', message: commandErrorMessage(error, '操作未完成，请检查后重试。')});
        return false;
      }
    },
    [read],
  );

  const askConfirmation = useCallback((title: string, content: ReactNode, run: () => Promise<void>) => {
    setConfirmation({title, content, run});
  }, []);

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
    if (!basePath || !selectedMenu || !renameName.trim()) return;
    renameLifecycle.setSubmitting(true);
    const succeeded = await runCommand(
      () => commands.rename(basePath, {name: renameName.trim(), expectedVersion: selectedMenu.version}),
      '菜单名称已更新。',
      () => renameLifecycle.closeAfterSuccess(),
    );
    if (!succeeded) renameLifecycle.setSubmitting(false);
  }, [basePath, commands, renameLifecycle, renameName, runCommand, selectedMenu]);

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

  const copyMenu = useCallback(() => {
    if (!basePath || !selectedMenu) return;
    void runCommand(
      () => commands.copy(basePath, {expectedVersion: selectedMenu.version}),
      '菜单已复制，并已刷新菜单列表。',
      result => {
        const targetRef = (result as SalesMenuCommandReadback).targetRef;
        if (targetRef) read.selectMenu(targetRef);
      },
    );
  }, [basePath, commands, read, runCommand, selectedMenu]);

  const toggleMenu = useCallback(
    (menu: SalesMenuSummary) => {
      if (!storeRef || !selectedChannelRef || !canEdit) return;
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
              status: menu.activation?.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
              expectedVersion: menu.version,
            },
          ),
        menu.activation?.status === 'ENABLED' ? '菜单已停用。' : '菜单已启用。',
      );
    },
    [canEdit, commands, queryContext.groupWorkspaceKey, runCommand, selectedChannelRef, storeRef],
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
        read.refresh();
        setFeedback({type: 'success', message: '销售项已保存。'});
        return true;
      } catch (error) {
        setFeedback({type: 'error', message: commandErrorMessage(error, '销售项保存失败，请检查后重试。')});
        throw error;
      }
    },
    [basePath, commands, read],
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
        read.refresh();
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
    setStatusChoice(item.manualSaleStatus.state === 'MANUAL_SOLD_OUT' ? 'SOLD_OUT' : 'NORMAL');
    setSoldOutReason('');
  }, []);

  const submitStatus = useCallback(() => {
    if (!statusItem || !basePath || !selectedChannelRef || !canEdit) return;
    if (statusChoice === 'SOLD_OUT' && !soldOutReason.trim()) {
      setFeedback({type: 'error', message: '设置人工沽清时必须填写原因。'});
      return;
    }
    if (statusChoice === 'NORMAL') {
      setStatusItem(undefined);
      askConfirmation('确认恢复销售？', '恢复的是人工销售状态；库存自动不可售不会在此处恢复。', async () => {
        await runCommand(
          () =>
            commands.restore(
              {...basePath, salesItemRef: statusItem.salesItemRef, channelRef: selectedChannelRef},
              {confirm: true, expectedVersion: statusItem.version},
            ),
          '销售状态已恢复为正常销售。',
        );
      });
      return;
    }
    void runCommand(
      () =>
        commands.soldOut(
          {...basePath, salesItemRef: statusItem.salesItemRef, channelRef: selectedChannelRef},
          {reason: soldOutReason.trim(), expectedVersion: statusItem.version},
        ),
      '销售状态已设置为沽清。',
      () => setStatusItem(undefined),
    );
  }, [
    askConfirmation,
    basePath,
    canEdit,
    commands,
    runCommand,
    selectedChannelRef,
    soldOutReason,
    statusChoice,
    statusItem,
  ]);

  const channelCards = read.channels.page?.items ?? [];
  const selectorItems = [...(read.selector.page?.items ?? [])];
  if (selectedMenu && !selectorItems.some(menu => menu.salesMenuRef === selectedMenu.salesMenuRef))
    selectorItems.unshift(selectedMenu);
  const channelProblem = problemMessage(read.channels.query.error, '经营入口暂时无法获取，请重试。');
  const menuProblem = problemMessage(read.selector.query.error, '菜单列表暂时无法获取，请重试。');

  return (
    <div {...testId(salesMenuTestIds.page)} data-scope-ref={queryContext.scopeRef}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        <Typography.Title level={2} style={{margin: 0}}>
          门店销售菜单
        </Typography.Title>
        {feedback && (
          <Alert
            type={feedback.type}
            showIcon
            title={feedback.message}
            closable
            onClose={() => setFeedback(undefined)}
          />
        )}
        {!read.scopeReady ? (
          <Alert type="info" showIcon title="请先选择门店数据节点。" />
        ) : (
          <>
            <Card title="经营入口" size="small" {...testId(salesMenuTestIds.channelCards)}>
              {channelProblem && (
                <Alert
                  type="error"
                  showIcon
                  title={channelProblem}
                  action={<Button onClick={() => void read.channels.query.refetch()}>重试</Button>}
                />
              )}
              <Row gutter={[12, 12]}>
                {channelCards.map(channel => (
                  <Col xs={24} sm={12} key={channel.channelRef}>
                    <Card
                      size="small"
                      hoverable
                      onClick={() => read.selectChannel(channel.channelRef)}
                      style={{borderColor: channel.channelRef === selectedChannelRef ? '#1677ff' : undefined}}
                      {...testId(salesMenuTestIds.channelCard(channel.channelRef))}
                    >
                      <Space direction="vertical" size={4} style={{display: 'flex'}}>
                        <Space>
                          <Typography.Text strong>{channel.channelName}</Typography.Text>
                          {channel.channelRef === selectedChannelRef && <Tag color="blue">当前入口</Tag>}
                        </Space>
                        <Typography.Text type={channel.status === 'ENABLED' ? 'success' : 'warning'}>
                          {salesMenuChannelStatusLabel(channel.status)}
                        </Typography.Text>
                        <Typography.Text type="secondary">菜单按顺序游标分页查看</Typography.Text>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
              {read.channels.query.isFetching && channelCards.length === 0 && <Spin />}
              {!read.channels.query.isFetching && channelCards.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可管理的堂食或外带经营入口" />
              )}
              <CursorPagination
                state={read.channels.cursor}
                nextCursor={read.channels.page?.nextCursor ?? undefined}
                testIdPrefix={salesMenuTestIds.pageCursor}
                style={{marginTop: 12}}
              />
            </Card>
            <Card size="small" title="菜单工作区">
              <Space direction="vertical" size={12} style={{display: 'flex'}}>
                <Row gutter={[12, 12]} align="middle">
                  <Col flex="none">
                    <Segmented<SalesMenuMode>
                      value={read.mode}
                      onChange={value => read.setMode(value)}
                      options={[
                        {label: '前台菜单', value: 'PUBLISHED'},
                        {label: '草稿菜单', value: 'DRAFT'},
                        {label: '操作记录', value: 'OPERATIONS'},
                      ]}
                      {...testId(salesMenuTestIds.modes)}
                    />
                  </Col>
                  <Col flex="auto">
                    <Space wrap>
                      <Select
                        value={selectedMenuRef}
                        placeholder="选择菜单"
                        loading={read.selector.query.isFetching}
                        disabled={!selectedChannelRef || selectorItems.length === 0}
                        style={{minWidth: 260}}
                        options={selectorItems.map(menu => ({
                          value: menu.salesMenuRef,
                          label: (
                            <Space>
                              <span>{menu.name}</span>
                              <Typography.Text type="secondary">{menuStateLabel(menu)}</Typography.Text>
                            </Space>
                          ),
                        }))}
                        onChange={value => read.selectMenu(value as Uuid)}
                        {...testId(salesMenuTestIds.menuSelector)}
                      />
                      <Button onClick={() => setManagerOpen(true)} disabled={!selectedChannelRef}>
                        管理菜单
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={event => {
                          createTriggerRef.current = event.currentTarget;
                          setCreateOpen(true);
                        }}
                        disabled={!canEdit || !selectedChannelRef}
                      >
                        新建菜单
                      </Button>
                    </Space>
                  </Col>
                </Row>
                {menuProblem && (
                  <Alert
                    type="error"
                    showIcon
                    title={menuProblem}
                    action={<Button onClick={() => void read.selector.query.refetch()}>重试</Button>}
                  />
                )}
                <CursorPagination
                  state={read.selector.cursor}
                  nextCursor={read.selector.page?.nextCursor ?? undefined}
                  testIdPrefix={salesMenuTestIds.selectorCursor}
                />
                {selectedMenu && (
                  <Space wrap>
                    <Tag>{menuStateLabel(selectedMenu)}</Tag>
                    <Typography.Text type="secondary">
                      {salesMenuScheduleLabel(selectedMenu.draftSchedule)}
                    </Typography.Text>
                    <Dropdown
                      menu={{
                        items: [
                          {key: 'rename', label: '重命名', disabled: !canEdit},
                          {key: 'copy', label: '复制', disabled: !canEdit},
                          {
                            key: 'activation',
                            label: selectedMenu.activation?.status === 'ENABLED' ? '停用' : '启用',
                            disabled: !canEdit,
                          },
                          {key: 'schedule', label: '生效与时段', disabled: !canEdit},
                          {key: 'publish', label: '更新到前台', disabled: !canEdit},
                          {type: 'divider'},
                          {
                            key: 'archive',
                            label: '归档菜单',
                            danger: true,
                            disabled: !canEdit || selectedMenu.archived,
                          },
                        ],
                        onClick: event => {
                          if (event.key === 'rename') {
                            setRenameName(selectedMenu.name);
                            setRenameOpen(true);
                          }
                          if (event.key === 'copy') copyMenu();
                          if (event.key === 'activation' && basePath && selectedChannelRef) {
                            void runCommand(
                              () =>
                                commands.activate(
                                  {...basePath, channelRef: selectedChannelRef},
                                  {
                                    status: selectedMenu.activation?.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
                                    expectedVersion: selectedMenu.version,
                                  },
                                ),
                              selectedMenu.activation?.status === 'ENABLED' ? '菜单已停用。' : '菜单已启用。',
                            );
                          }
                          if (event.key === 'schedule') {
                            setSchedule(selectedMenu.draftSchedule);
                            setScheduleOpen(true);
                          }
                          if (event.key === 'publish') setPublishOpen(true);
                          if (event.key === 'archive' && basePath) {
                            askConfirmation(
                              '归档当前菜单？',
                              '归档只会停止当前菜单的管理使用，不会删除商品或历史操作记录。',
                              async () => {
                                await runCommand(
                                  () => commands.archive(basePath, {expectedVersion: selectedMenu.version}),
                                  '菜单已归档。',
                                );
                              },
                            );
                          }
                        },
                      }}
                    >
                      <Button onMouseDown={event => (menuActionTriggerRef.current = event.currentTarget)}>
                        菜单动作 <DownOutlined />
                      </Button>
                    </Dropdown>
                    <Button icon={<ReloadOutlined />} onClick={() => read.refresh()}>
                      刷新
                    </Button>
                  </Space>
                )}
              </Space>
            </Card>
            {!selectedMenu ? (
              <Card size="small">
                <Empty description={selectedChannelRef ? '请选择菜单' : '请先选择经营入口'} />
              </Card>
            ) : (
              <Row gutter={[16, 16]} align="top">
                <Col xs={24} lg={6}>
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
                <Col xs={24} lg={18}>
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

      <SalesMenuManagerDrawer
        open={managerOpen}
        read={read}
        onClose={() => setManagerOpen(false)}
        onSelect={menu => {
          read.selectMenu(menu.salesMenuRef);
          setManagerOpen(false);
        }}
        onToggle={toggleMenu}
        canEdit={canEdit}
      />
      <SalesMenuCandidateDrawer
        open={candidateOpen && read.candidateOpen}
        read={read}
        onClose={() => {
          read.closeCandidates();
          setCandidateOpen(false);
        }}
        onAdd={addCandidates}
        onClosedFocus={() => {
          window.requestAnimationFrame(() => {
            candidateTriggerRef.current?.focus();
            candidateTriggerRef.current = null;
          });
        }}
      />
      <SalesMenuItemEditorDrawer
        item={editorItem}
        open={editorOpen}
        queryContext={queryContext}
        menuRef={selectedMenuRef}
        commands={commands}
        onSave={saveItem}
        onClose={() => setEditorOpen(false)}
        onSaved={() => setEditorItem(undefined)}
        onDelete={deleteItem}
        onClosedFocus={() => {
          editorTriggerRef.current?.focus();
          editorTriggerRef.current = null;
        }}
      />
      <SalesMenuItemDetailDrawer
        item={detailItem}
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(undefined)}
      />

      <Drawer
        open={createOpen}
        title="新建菜单"
        onClose={createLifecycle.requestClose}
        afterOpenChange={createAfterOpenChange}
        maskClosable={!createLifecycle.submitting}
        keyboard={!createLifecycle.submitting}
        closable={!createLifecycle.submitting}
        footer={
          <Space>
            <Button onClick={createLifecycle.requestClose} disabled={createLifecycle.submitting}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={() => void createMenu()}
              disabled={!createName.trim() || createLifecycle.submitting}
              loading={createLifecycle.submitting}
            >
              创建菜单
            </Button>
          </Space>
        }
        {...adminDrawerSurfaceProps}
      >
        <Input
          value={createName}
          onChange={event => {
            setCreateName(event.target.value);
            createLifecycle.setDirty(true);
            createLifecycle.markBusinessIntentChanged();
          }}
          placeholder="请输入菜单名称"
          autoFocus
        />
      </Drawer>
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
              disabled={!renameName.trim() || !basePath || !selectedMenu || renameLifecycle.submitting}
              loading={renameLifecycle.submitting}
              onClick={() => void renameMenu()}
            >
              保存名称
            </Button>
          </Space>
        }
        {...adminDrawerSurfaceProps}
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
        okButtonProps={{disabled: !sectionName.trim() || !basePath || !selectedMenu || commands.isBusy}}
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
            <Radio value="ALL_DAY">全天</Radio>
            <Radio value="DAILY_TIME_RANGE">每日时段</Radio>
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
              />
            </Space>
          )}
          <Typography.Text type="secondary">当前设置：{salesMenuScheduleLabel(schedule)}</Typography.Text>
        </Space>
      </Drawer>
      <PublishDrawer
        open={publishOpen}
        read={read}
        canEdit={canEdit}
        onClose={() => setPublishOpen(false)}
        onPublish={() => {
          if (!basePath || !selectedMenu) return;
          void runCommand(
            () => commands.publish(basePath, {expectedVersion: selectedMenu.version}),
            '本系统已生成新的前台菜单。该结果不代表收银端、扫码端或自助机已经获取。',
            () => setPublishOpen(false),
          );
        }}
      />
      <Modal
        open={Boolean(statusItem)}
        title="销售状态"
        onCancel={() => setStatusItem(undefined)}
        maskClosable={!commands.isBusy}
        keyboard={!commands.isBusy}
        closable={!commands.isBusy}
        okText={statusChoice === 'SOLD_OUT' ? '设置为沽清' : '恢复正常销售'}
        cancelText="取消"
        cancelButtonProps={{disabled: commands.isBusy}}
        confirmLoading={commands.isBusy}
        onOk={submitStatus}
      >
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          <Radio.Group value={statusChoice} onChange={event => setStatusChoice(event.target.value)}>
            <Radio value="NORMAL">正常销售</Radio>
            <Radio value="SOLD_OUT">人工沽清</Radio>
          </Radio.Group>
          {statusChoice === 'SOLD_OUT' && (
            <Input.TextArea
              value={soldOutReason}
              onChange={event => setSoldOutReason(event.target.value)}
              placeholder="请填写人工沽清原因"
              rows={4}
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
