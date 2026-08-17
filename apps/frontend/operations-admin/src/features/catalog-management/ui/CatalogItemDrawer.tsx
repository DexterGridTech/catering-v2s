import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Typography,
  Upload,
} from 'antd';
import {
  adminWideDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  DescriptorFieldRenderer,
  digestFileContent,
  NameCodeText,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import type {DescriptorTreeNode} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogItemSaveRequest,
  type CatalogShapeManifestView,
  type JsonValue,
  type TemporaryPromotionExecuteRequest,
  type TemporaryPromotionPreflight,
  type TemporaryPromotionPreflightRequest,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import type {
  CatalogCompositeComponent,
  CatalogCompositeGroup,
  CatalogDetail,
  CatalogInventoryBomEntry,
  CatalogNavigation,
  CatalogOrderOptionGroup,
  CatalogOrderOptionValue,
  CatalogSkuRow,
  CatalogSkuVariantDimension,
} from '../model/catalogModel';
import {
  attributeDraftRowsFromRecord,
  buildCatalogSkuVoidRequest,
  buildSkuMatrix,
  catalogFormValidationIssue,
  catalogSkuIssueCodes,
  decodeCatalogMediaLimits,
  decodeDetail,
  decodeItems,
  decodeNavigation,
  displayValue,
  duplicateCatalogAttributeKeys,
  mergeCatalogSkuVoidReadback,
  serializeCatalogAttributeDraftRows,
  serializeSkuRowsForSave,
  shouldHydrateCatalogItemDraft,
  type CatalogAttributeDraftRow,
  type CatalogMediaLimits,
} from '../model/catalogModel';
import {catalogEnumLabel, catalogEnumOptions, catalogFieldLabel} from '../model/catalogManifestLabels';
import {catalogTabLabel} from '../model/catalogTabLabels';
import {catalogJoinedField, type CatalogDescriptorManifest} from '../model/catalogDescriptorManifest';
import {
  createCatalogOptionResolver,
  type CatalogCandidateRow,
  type CatalogFieldRuntimeContext,
} from '../model/catalogFieldRuntime';
import {CatalogDescriptorPicker} from './CatalogDescriptorPicker';
import {
  CatalogDictionaryDrawer,
  type CatalogDictionaryQuickManageCandidate,
  type DictionaryKind,
  type ProductionTagCandidate,
} from './CatalogDictionaryDrawer';
import {LocalCatalogCopyDrawer} from './LocalCatalogCopyDrawer';
import {CatalogAssetPreview} from './CatalogAssetPreview';

type Props = {
  itemCode?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWriteCatalog: boolean;
  surface: 'store' | 'brand';
  navigation?: CatalogNavigation;
  onOpenProductionTags?: () => void;
  dictionaryRevision?: Partial<Record<DictionaryKind, number>>;
  onVoidAndRebuild?: (source: {code: string; name: string; shapeKey: string}) => void;
  onClose: () => void;
  onChanged: () => void;
};

type MediaDraft = {
  id: string;
  assetRef?: string;
  bindGrant?: string;
  fileName: string;
  mediaType: string;
  status: 'READY' | 'UPLOADING' | 'FAILED';
  file?: File;
  error?: string;
  version?: number;
  staged: boolean;
  skuIndex?: number;
  previous?: {assetRef?: string; version?: number; staged: boolean};
};
type ProfileLayer = 'item' | 'sku' | 'optionValue';
type ProductionProfileDraft = CatalogDetail['item']['productionProfiles'];
type SkuDimensionDraft = CatalogSkuVariantDimension;
type CatalogIdentifierDraft = CatalogDetail['item']['identifiers'][number] & {editorId: string};
type SkuRowDraft = CatalogSkuRow & {editorId: string};
type CatalogOrderOptionValueDraft = CatalogOrderOptionValue & {editorId: string};
type CatalogOrderOptionGroupDraft = Omit<CatalogOrderOptionGroup, 'values'> & {
  values: CatalogOrderOptionValueDraft[];
};
type CatalogDictionaryQuickManageKind = Exclude<DictionaryKind, 'PRODUCTION_TAG'>;
type ProductionTagOption = {tagRef: string; code: string; name: string; owner: string; status?: string};
type PromotionFormValues = Pick<
  TemporaryPromotionPreflightRequest,
  'formalCode' | 'shapeKey' | 'name' | 'shortName' | 'materialRole'
>;
type CatalogManifest = Pick<
  CatalogShapeManifestView,
  'enumLabels' | 'fields' | 'fieldRules' | 'tabRules' | 'typeEffects'
>;
// These values stay inside an incomplete editor draft. They are validated by
// wireUuid only when a request is assembled for a generated endpoint.
const draftUuid = (value = ''): ReturnType<typeof wireUuid> => value as ReturnType<typeof wireUuid>;

const profileLayerLabels: Record<ProfileLayer, string> = {item: '商品', sku: 'SKU', optionValue: '选项值'};
const profileFields: Array<{
  key: 'printName' | 'stationTags' | 'printTags' | 'estimatedPreparationSeconds' | 'preparationNotes' | 'allergens';
  label: string;
  kind: 'text' | 'tags' | 'number';
}> = [
  {key: 'printName', label: '打印名称', kind: 'text'},
  {key: 'stationTags', label: '处理标签', kind: 'tags'},
  {key: 'printTags', label: '打印标签', kind: 'tags'},
  {key: 'estimatedPreparationSeconds', label: '预计制作秒数', kind: 'number'},
  {key: 'preparationNotes', label: '生产备注', kind: 'text'},
  {key: 'allergens', label: '过敏原', kind: 'tags'},
];

function cloneProfiles(value: ProductionProfileDraft): ProductionProfileDraft {
  return {item: {...value.item}, sku: {...value.sku}, optionValue: {...value.optionValue}};
}
function cloneSkuDimensions(value: SkuDimensionDraft[]): SkuDimensionDraft[] {
  return value.map(dimension => ({...dimension, values: dimension.values.map(entry => ({...entry}))}));
}
function cloneSkuRows(value: CatalogSkuRow[]): CatalogSkuRow[] {
  return value.map(sku => ({
    ...sku,
    attributeValueRefs: sku.attributeValueRefs.map(entry => ({...entry})),
    mediaRefs: [...sku.mediaRefs],
  }));
}
function profileString(profile: Record<string, JsonValue>, key: string) {
  const value = profile[key];
  return typeof value === 'string' ? value : '';
}
function profileTags(profile: Record<string, JsonValue>, key: string) {
  const value = profile[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
function profileNumber(profile: Record<string, JsonValue>, key: string) {
  const value = profile[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function splitComma(value: string) {
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}
function profileDisplayValue(value: JsonValue) {
  return Array.isArray(value) ? value.map(entry => displayValue(entry)).join('、') || '—' : displayValue(value);
}
function descriptorString(value: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}
function descriptorRow(value: CatalogCandidateRow | CatalogCandidateRow[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function catalogVoidBlockReason(availability: CatalogDetail['actionAvailability']['voidAvailability'] | undefined) {
  if (availability?.canVoid) return undefined;
  const factCount = (availability?.blockingReferences.length ?? 0) + (availability?.dependentFacts.length ?? 0);
  return factCount ? `存在 ${factCount} 条关联或依赖，暂不能作废。` : '当前商品暂不能作废。';
}

const catalogDeniedFieldLabels: Record<string, string> = {
  name: '商品名称',
  shortName: '短名',
  attributes: '描述属性',
  identifiers: '标识与条码',
  categoryRefs: '分类',
  tagRefs: '商品标签',
  salesUnitRefs: '销售单位',
  standardSalePrice: '商品标准价',
  images: '图片资产',
  productionTagRefs: '生产提示与生产标签',
  skuVariantDimensions: 'SKU 规格维度',
  skuVariantAttribute: 'SKU 规格属性',
  skuVariantValues: 'SKU 规格值',
  skuMatrix: 'SKU 矩阵',
  skus: 'SKU 矩阵',
  orderOptions: '点单选项',
  productionProfiles: '生产提示',
  bomTarget: '库存对象',
  bomOptionValue: '库存 BOM 所属选项值',
  inventoryBom: '库存与 BOM',
  compositeComponentSku: '套餐组件 SKU',
  compositeGroups: '套餐内容',
};

function deniedFieldLabel(manifest: CatalogManifest | undefined, fieldKey: string) {
  const label = catalogDeniedFieldLabels[fieldKey] ?? catalogFieldLabel(manifest, fieldKey);
  return label === fieldKey ? '上游维护字段' : label;
}

type DisabledReasonButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  reason?: string;
  children: ReactNode;
};

function DisabledReasonButton({reason, disabled, children, ...props}: DisabledReasonButtonProps) {
  const button = (
    <Button {...props} disabled={disabled}>
      {children}
    </Button>
  );
  if (!disabled || !reason) return button;
  return (
    <Tooltip title={reason}>
      <span style={{display: 'inline-block'}}>{button}</span>
    </Tooltip>
  );
}

export function CatalogItemDrawer({
  itemCode,
  queryContext,
  brandRef,
  canWriteCatalog,
  surface,
  navigation,
  onOpenProductionTags,
  dictionaryRevision = {},
  onVoidAndRebuild,
  onClose,
  onChanged,
}: Props) {
  void surface;
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [activeTab, setActiveTab] = useState('basic');
  const [problem, setProblem] = useState<string>();
  const [localCopyOpen, setLocalCopyOpen] = useState(false);
  const [productionTagQuickManageOpen, setProductionTagQuickManageOpen] = useState(false);
  const [dictionaryQuickManage, setDictionaryQuickManage] = useState<{
    kind: CatalogDictionaryQuickManageKind;
    dimensionIndex?: number;
    valueIndex?: number;
    parentEntryRef?: string;
  }>();
  const [localDictionaryRevisions, setLocalDictionaryRevisions] = useState<Partial<Record<DictionaryKind, number>>>({});
  const [selectedProductionTagRefs, setSelectedProductionTagRefs] = useState<string[]>([]);
  const [selectedProductionTags, setSelectedProductionTags] = useState<ProductionTagOption[]>([]);
  const [selectedTagRefs, setSelectedTagRefs] = useState<string[]>([]);
  const [selectedSalesUnitRefs, setSelectedSalesUnitRefs] = useState<string[]>([]);
  const initializedDraftItem = useRef<string | undefined>(undefined);
  const hydrateDraftAfterSave = useRef(false);
  const initializedProductionItem = useRef<string | undefined>(undefined);
  const problemRef = useRef<HTMLDivElement | null>(null);
  const draftRowSequence = useRef(0);
  const createDraftRowId = useCallback((prefix: string) => {
    draftRowSequence.current += 1;
    return `${prefix}-${draftRowSequence.current}`;
  }, []);
  const normalizeSkuDraftRows = useCallback(
    (rows: CatalogSkuRow[]): SkuRowDraft[] =>
      rows.map(row => {
        const draftRow = row as Partial<SkuRowDraft>;
        return {
          ...row,
          editorId: row.productSkuRef.trim() || draftRow.editorId || createDraftRowId('sku'),
        };
      }),
    [createDraftRowId],
  );
  const [mediaDraft, setMediaDraft] = useState<MediaDraft[]>([]);
  const [skuStagedMedia, setSkuStagedMedia] = useState<MediaDraft[]>([]);
  const initializedMediaItem = useRef<string | undefined>(undefined);
  const [mediaProblem, setMediaProblem] = useState<string>();
  const [releaseCloseFailed, setReleaseCloseFailed] = useState(false);
  const [releasingBeforeClose, setReleasingBeforeClose] = useState(false);
  const [identifierDraft, setIdentifierDraft] = useState<CatalogIdentifierDraft[]>([]);
  const [categoryRefsDraft, setCategoryRefsDraft] = useState<string[]>([]);
  const [standardSalePriceDraft, setStandardSalePriceDraft] = useState<number | null>(null);
  const [orderOptionsDraft, setOrderOptionsDraft] = useState<CatalogOrderOptionGroupDraft[]>([]);
  const [productionProfilesDraft, setProductionProfilesDraft] = useState<ProductionProfileDraft>({
    item: {},
    sku: {},
    optionValue: {},
  });
  const [productionProfileLayer, setProductionProfileLayer] = useState<ProfileLayer>('item');
  const [inventoryBomDraft, setInventoryBomDraft] = useState<CatalogInventoryBomEntry[]>([]);
  const [compositeGroupsDraft, setCompositeGroupsDraft] = useState<CatalogCompositeGroup[]>([]);
  const [skuVariantDimensionsDraft, setSkuVariantDimensionsDraft] = useState<SkuDimensionDraft[]>([]);
  const [skusDraft, setSkusDraft] = useState<SkuRowDraft[]>([]);
  const [promotion, setPromotion] = useState<TemporaryPromotionPreflight['data']>();
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionProblem, setPromotionProblem] = useState<string>();
  const [voidingSkuRef, setVoidingSkuRef] = useState<string>();
  const [form] = Form.useForm<{
    displayName: string;
    shortName?: string;
    attributesDraftRows: CatalogAttributeDraftRow[];
  }>();
  const [promotionForm] = Form.useForm<PromotionFormValues>();
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItem(
        {itemCode: itemCode ?? ''},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, itemCode, queryContext.scopeRef],
  );
  const detailQuery = operationsRtk.useGetOperationsCatalogItemQuery(request, {skip: !itemCode});
  const detail = useMemo(() => decodeDetail(detailQuery.data), [detailQuery.data]);
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !itemCode});
  const manifest = manifestQuery.currentData?.data;
  const mediaLimits = useMemo(() => decodeCatalogMediaLimits(manifest), [manifest]);
  const productionTagsRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsProductionTags(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const productionTagsQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionTagsRequest, {
    skip: !itemCode || !canWriteCatalog,
  });
  const availableProductionTags: ProductionTagOption[] = (productionTagsQuery.data?.data.entries ?? []).map(entry => ({
    tagRef: entry.tagRef,
    code: entry.code,
    name: entry.name,
    owner: 'fulfillment-production',
    status: entry.status,
  }));
  const [save] = operationsRtk.useSaveOperationsCatalogItemMutation();
  const [stageAsset] = operationsRtk.useStageOperationsCatalogAssetMutation();
  const [releaseAsset] = operationsRtk.useReleaseOperationsCatalogStagedAssetMutation();
  const [transition] = operationsRtk.useTransitionOperationsCatalogItemStatusMutation();
  const [preflightPromotion, preflightPromotionState] =
    operationsRtk.usePreflightOperationsTemporaryCatalogItemPromotionMutation();
  const [executePromotion, executePromotionState] =
    operationsRtk.useExecuteOperationsTemporaryCatalogItemPromotionMutation();
  const releaseStagedAsset = useCallback(
    async (asset: MediaDraft) => {
      if (!asset.staged || !asset.assetRef || asset.version === undefined) return true;
      try {
        const dataNodeRef = requireOperationsScopeRef(queryContext);
        const assetRef = wireUuid(asset.assetRef);
        const body = {dataNodeRef, assetRef, expectedVersion: asset.version};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.releaseOperationsCatalogStagedAsset,
          body,
        );
        await releaseAsset(
          catalogInventoryRtkRequest.releaseOperationsCatalogStagedAsset(
            {assetRef},
            {
              headers: {...headers, 'Idempotency-Key': idempotencyKey},
              body,
            },
          ),
        ).unwrap();
        return true;
      } catch (error) {
        setMediaProblem(operationsProblemOf(error).detail || '图片资产释放未完成，请重试。');
        return false;
      }
    },
    [headers, queryContext, releaseAsset],
  );
  const releaseStagedMedia = useCallback(
    async (assets: MediaDraft[]) => {
      const staged = assets.filter(asset => asset.staged && asset.assetRef && asset.version !== undefined);
      return Promise.all(staged.map(async asset => ({asset, released: await releaseStagedAsset(asset)})));
    },
    [releaseStagedAsset],
  );
  const closeAfterStagedRelease = useCallback(async () => {
    setReleaseCloseFailed(false);
    setReleasingBeforeClose(true);
    const outcomes = await releaseStagedMedia([...mediaDraft, ...skuStagedMedia]);
    const released = outcomes.every(outcome => outcome.released);
    const releasedIds = new Set(outcomes.filter(outcome => outcome.released).map(outcome => outcome.asset.id));
    if (releasedIds.size > 0) {
      setMediaDraft(current => current.map(asset => (releasedIds.has(asset.id) ? {...asset, staged: false} : asset)));
      setSkuStagedMedia(current =>
        current.map(asset => (releasedIds.has(asset.id) ? {...asset, staged: false} : asset)),
      );
    }
    setReleasingBeforeClose(false);
    if (!released) {
      setReleaseCloseFailed(true);
      setMediaProblem('图片资产释放未完成，请重试关闭。');
      return;
    }
    onClose();
  }, [mediaDraft, onClose, releaseStagedMedia, skuStagedMedia]);
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(itemCode),
    onOpenChange: open => {
      if (!open) void closeAfterStagedRelease();
    },
    dirtyMessage: '商品编辑内容尚未保存。',
    dirtyGuardTestIds: {confirm: testId('catalog-item-dirty-discard'), cancel: testId('catalog-item-dirty-continue')},
    diagnosticOperationId: 'catalog-item-editor',
  });
  useEffect(() => {
    if (!detail) return;
    if (
      !shouldHydrateCatalogItemDraft({
        initializedItemCode: initializedDraftItem.current,
        detailItemCode: detail.item.code,
        dirty: lifecycle.dirty,
        forceHydrate: hydrateDraftAfterSave.current,
      })
    )
      return;
    initializedDraftItem.current = detail.item.code;
    hydrateDraftAfterSave.current = false;
    form.setFieldsValue({
      displayName: detail.item.name,
      shortName: detail.item.shortName ?? '',
      attributesDraftRows: attributeDraftRowsFromRecord(detail.item.attributes),
    });
    setIdentifierDraft(detail.item.identifiers.map(entry => ({...entry, editorId: createDraftRowId('identifier')})));
    setCategoryRefsDraft([...detail.item.categoryRefs]);
    setStandardSalePriceDraft(detail.item.standardSalePrice ?? null);
    setSelectedTagRefs([...detail.item.tagRefs]);
    setSelectedSalesUnitRefs([...detail.item.salesUnitRefs]);
    setOrderOptionsDraft(
      detail.item.orderOptions.map(group => ({
        ...group,
        values: group.values.map(entry => ({
          ...entry,
          editorId: createDraftRowId('order-option-value'),
          productionEffects: [...entry.productionEffects],
        })),
      })),
    );
    setProductionProfilesDraft(cloneProfiles(detail.item.productionProfiles));
    setProductionProfileLayer('item');
    setInventoryBomDraft(detail.inventoryBom.map(entry => ({...entry})));
    setCompositeGroupsDraft(
      detail.compositeGroups.map(group => ({...group, components: group.components.map(entry => ({...entry}))})),
    );
    setSkuVariantDimensionsDraft(cloneSkuDimensions(detail.item.skuVariantDimensions));
    setSkusDraft(normalizeSkuDraftRows(cloneSkuRows(detail.item.skus)));
    if (initializedProductionItem.current !== detail.item.code) {
      initializedProductionItem.current = detail.item.code;
      setSelectedProductionTagRefs(detail.item.productionTagRefs);
      setSelectedProductionTags(detail.productionTags);
    }
    if (initializedMediaItem.current !== detail.item.code) {
      initializedMediaItem.current = detail.item.code;
      setMediaDraft(
        detail.item.images.map((assetRef, index) => ({
          id: `existing-${assetRef}-${index}`,
          assetRef,
          fileName: index === 0 ? '已保存主图' : `已保存附图 ${index}`,
          mediaType: 'image/*',
          status: 'READY',
          staged: false,
        })),
      );
      setMediaProblem(undefined);
    }
    const first = detail.tabs.find(tab => tab.visible)?.tabKey;
    setActiveTab(current =>
      detail.tabs.some(tab => tab.tabKey === current && tab.visible) ? current : (first ?? 'basic'),
    );
  }, [createDraftRowId, detail, form, lifecycle, normalizeSkuDraftRows]);
  useEffect(() => {
    if (!(problem || detailQuery.error || mediaProblem)) return;
    window.requestAnimationFrame(() => problemRef.current?.focus());
  }, [detailQuery.error, mediaProblem, problem]);
  useEffect(() => {
    if (!itemCode) {
      initializedDraftItem.current = undefined;
      hydrateDraftAfterSave.current = false;
      initializedProductionItem.current = undefined;
      initializedMediaItem.current = undefined;
      setMode('view');
      setProblem(undefined);
      setMediaProblem(undefined);
      setReleaseCloseFailed(false);
      setReleasingBeforeClose(false);
      setMediaDraft([]);
      setSkuStagedMedia([]);
      setIdentifierDraft([]);
      setCategoryRefsDraft([]);
      setSelectedTagRefs([]);
      setSelectedSalesUnitRefs([]);
      setOrderOptionsDraft([]);
      setProductionProfilesDraft({item: {}, sku: {}, optionValue: {}});
      setInventoryBomDraft([]);
      setCompositeGroupsDraft([]);
      setSkuVariantDimensionsDraft([]);
      setSkusDraft([]);
      setLocalCopyOpen(false);
      setProductionTagQuickManageOpen(false);
      setDictionaryQuickManage(undefined);
      setLocalDictionaryRevisions({});
      setPromotion(undefined);
      setPromotionOpen(false);
      setPromotionProblem(undefined);
      lifecycle.reset();
    }
  }, [itemCode, lifecycle]);

  const submit = async () => {
    if (!detail || !itemCode) return;
    if (mediaDraft.some(asset => asset.status === 'UPLOADING')) {
      setMediaProblem('图片仍在上传或处理中，请等待完成后再保存。');
      setActiveTab('basic');
      return;
    }
    if (mediaDraft.some(asset => asset.status === 'FAILED' && !asset.assetRef)) {
      setMediaProblem('存在未完成的图片上传，请重试或移除失败项后再保存。');
      setActiveTab('basic');
      return;
    }
    if (skuStagedMedia.some(asset => asset.status === 'UPLOADING')) {
      setMediaProblem('SKU 图片仍在上传或处理中，请等待完成后再保存。');
      setActiveTab('sku-specifications-pricing');
      return;
    }
    if (skuStagedMedia.some(asset => asset.status === 'FAILED' && !asset.assetRef)) {
      setMediaProblem('存在未完成的 SKU 图片上传，请重试或移除失败项后再保存。');
      setActiveTab('sku-specifications-pricing');
      return;
    }
    let values: {displayName: string; shortName?: string; attributesDraftRows: CatalogAttributeDraftRow[]};
    try {
      values = await form.validateFields();
    } catch (error) {
      const issue = catalogFormValidationIssue(error);
      setActiveTab(issue?.tabKey ?? 'basic');
      setProblem(issue?.message ?? '请先修正商品基础信息后再保存。');
      return;
    }
    let attributes: Record<string, JsonValue>;
    try {
      attributes = serializeCatalogAttributeDraftRows(values.attributesDraftRows ?? []);
    } catch {
      setActiveTab('attributes');
      setProblem('描述属性存在重复键，请修改后再保存。');
      return;
    }
    const visibleTabs = new Set(detail.tabs.filter(tab => tab.visible).map(tab => tab.tabKey));
    if (visibleTabs.has('identifiers')) {
      const invalidIndex = identifierDraft.findIndex(
        entry => !entry.kind.trim() || !entry.code.trim() || !entry.value.trim(),
      );
      if (invalidIndex >= 0) {
        setActiveTab('identifiers');
        setProblem(`条码与识别码第 ${invalidIndex + 1} 行缺少类型、编码或识别码。`);
        return;
      }
    }
    if (visibleTabs.has('order-options')) {
      const invalidGroup = orderOptionsDraft.findIndex(
        group =>
          !group.groupCode.trim() ||
          !group.groupName.trim() ||
          group.values.some(value => !value.code.trim() || !value.name.trim()),
      );
      if (invalidGroup >= 0) {
        setActiveTab('order-options');
        setProblem(`点单选项第 ${invalidGroup + 1} 组缺少组编码、组名或选项值信息。`);
        return;
      }
    }
    if (visibleTabs.has('sku-specifications-pricing')) {
      const invalidDimension = skuVariantDimensionsDraft.findIndex(
        dimension =>
          !dimension.attributeCode.trim() ||
          !dimension.attributeName.trim() ||
          dimension.values.some(value => !value.valueCode.trim() || !value.valueLabel.trim()),
      );
      const seenSkuCodes = new Set<string>();
      let invalidSku = -1;
      for (let index = 0; index < skusDraft.length; index += 1) {
        const sku = skusDraft[index];
        const code = sku.skuCode.trim();
        if (
          !code ||
          !sku.skuName.trim() ||
          seenSkuCodes.has(code) ||
          (detail.item.priceGranularity === 'SKU' && sku.status === 'ENABLED' && sku.standardSalePrice === null)
        ) {
          invalidSku = index;
          break;
        }
        seenSkuCodes.add(code);
      }
      if (invalidDimension >= 0) {
        setActiveTab('sku-specifications-pricing');
        setProblem(`SKU 规格第 ${invalidDimension + 1} 个维度缺少属性编码、名称或属性值信息。`);
        return;
      }
      if (invalidSku >= 0) {
        setActiveTab('sku-specifications-pricing');
        setProblem(`SKU 矩阵第 ${invalidSku + 1} 行缺少编码/名称、存在重复编码，或按 SKU 定价但启用 SKU 缺少标准价。`);
        return;
      }
    }
    if (visibleTabs.has('inventory-bom')) {
      const invalidNode = inventoryBomDraft.findIndex(node => {
        if (node.mode === 'NONE') return false;
        if (node.mode === 'BOM') return !node.targetRef.trim() || !node.quantity.trim() || !node.unit.trim();
        if (node.mode === 'INDEPENDENT_STOCK') return !(node.targetRef.trim() || node.consumptionUnit?.trim());
        return true;
      });
      if (invalidNode >= 0) {
        setActiveTab('inventory-bom');
        setProblem(`库存/BOM 第 ${invalidNode + 1} 个节点缺少合法模式、消耗数量/单位，或新建库存对象缺少消耗单位。`);
        return;
      }
    }
    if (visibleTabs.has('composite-content')) {
      const invalidGroup = compositeGroupsDraft.findIndex(
        group =>
          !group.groupCode.trim() ||
          !group.groupName.trim() ||
          group.components.some(
            component =>
              !component.itemCode.trim() ||
              !component.itemRef.trim() ||
              !component.quantity.trim() ||
              !component.unit.trim(),
          ),
      );
      if (invalidGroup >= 0) {
        setActiveTab('composite-content');
        setProblem(`套餐内容第 ${invalidGroup + 1} 组缺少分组编码、分组名、组件商品引用或数量/单位。`);
        return;
      }
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const catalogDraft: CatalogItemSaveRequest['sections']['catalogDraft'] = {
        shortName: values.shortName?.trim() || null,
        name: values.displayName,
        shapeKey: detail.item.shapeKey,
        attributes,
        images: mediaDraft
          .filter(asset => (asset.status === 'READY' || asset.status === 'FAILED') && asset.assetRef)
          .map(asset => wireUuid(asset.assetRef)),
        productionTagRefs: selectedProductionTagRefs.map(ref => wireUuid(ref)),
        tagRefs: selectedTagRefs.map(ref => wireUuid(ref)),
        salesUnitRefs: selectedSalesUnitRefs.map(ref => wireUuid(ref)),
        categoryRefs: categoryRefsDraft.map(ref => wireUuid(ref)),
      };
      if (visibleTabs.has('identifiers'))
        catalogDraft.identifiers = identifierDraft.map(({editorId: _editorId, ...entry}) => entry);
      if (visibleTabs.has('basic') && detail.item.priceGranularity === 'ITEM')
        catalogDraft.standardSalePrice = standardSalePriceDraft;
      if (visibleTabs.has('sku-specifications-pricing')) {
        catalogDraft.skuVariantDimensions = skuVariantDimensionsDraft;
        catalogDraft.skus = serializeSkuRowsForSave(skusDraft.map(({editorId: _editorId, ...row}) => row));
      }
      if (visibleTabs.has('order-options'))
        catalogDraft.orderOptions = orderOptionsDraft.map(({values, ...group}) => ({
          ...group,
          values: values.map(({editorId: _editorId, ...value}) => value),
        }));
      if (visibleTabs.has('composite-content')) catalogDraft.compositeGroups = compositeGroupsDraft;
      if (visibleTabs.has('production-prompts')) catalogDraft.productionProfiles = productionProfilesDraft;
      if (visibleTabs.has('inventory-bom'))
        catalogDraft.inventoryBom = inventoryBomDraft.map(entry => ({...entry, skuCode: entry.skuCode ?? null}));
      const bindGrants = Object.fromEntries(
        [...mediaDraft, ...skuStagedMedia]
          .filter((asset): asset is MediaDraft & {assetRef: string; bindGrant: string} =>
            Boolean(asset.assetRef && asset.bindGrant),
          )
          .map(asset => [asset.assetRef, asset.bindGrant]),
      );
      const body: CatalogItemSaveRequest = {
        dataNodeRef,
        itemCode,
        sections: {
          catalogDraft,
          inventoryConfiguration: {
            nodes: visibleTabs.has('inventory-bom')
              ? inventoryBomDraft
                  .filter(node => node.mode === 'INDEPENDENT_STOCK')
                  .map(node => ({
                    nodeType: node.nodeType,
                    mode: node.mode,
                    ...(node.targetRef.trim() ? {targetRef: wireUuid(node.targetRef.trim())} : {}),
                    itemCode: node.itemCode ?? detail.item.code,
                    skuCode: node.skuCode ?? null,
                    ...(node.consumptionUnit?.trim() ? {consumptionUnit: node.consumptionUnit.trim()} : {}),
                    ...(node.configuration ? {configuration: node.configuration} : {}),
                  }))
              : [],
          },
          expectedCatalogVersion: detail.item.version,
          expectedInventoryVersions: visibleTabs.has('inventory-bom')
            ? inventoryBomDraft
                .filter(
                  node => node.mode === 'INDEPENDENT_STOCK' && node.targetRef.trim() && node.version !== undefined,
                )
                .map(node => ({targetRef: wireUuid(node.targetRef), version: node.version as number}))
            : [],
        },
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
        body,
      );
      await save(
        catalogInventoryRtkRequest.saveOperationsCatalogItem(
          {itemCode},
          {
            headers: {
              ...headers,
              'Idempotency-Key': idempotencyKey,
              ...(Object.keys(bindGrants).length ? {'X-Catalog-Asset-Bind-Grants': JSON.stringify(bindGrants)} : {}),
            },
            body,
          },
        ),
      ).unwrap();
      hydrateDraftAfterSave.current = true;
      lifecycle.reset();
      setMode('view');
      setMediaDraft(current =>
        current.map(asset => ({...asset, bindGrant: undefined, file: undefined, staged: false})),
      );
      setSkuStagedMedia(current =>
        current.map(asset => ({...asset, bindGrant: undefined, file: undefined, staged: false})),
      );
      await detailQuery.refetch();
      onChanged();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
      lifecycle.setSubmitting(false);
    }
  };
  const changeStatus = async (targetStatus: 'ENABLED' | 'DISABLED' | 'ARCHIVED' | 'VOIDED') => {
    if (!detail || !itemCode) return;
    if (detail.item.source === 'TEMPORARY') return;
    if (targetStatus === 'VOIDED' && !detail.actionAvailability.voidAvailability?.canVoid) return;
    setProblem(undefined);
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {dataNodeRef, itemCode, targetStatus, expectedVersion: detail.item.version};
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogItemStatus,
        body,
      );
      await transition(
        catalogInventoryRtkRequest.transitionOperationsCatalogItemStatus(
          {itemCode},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      await detailQuery.refetch();
      onChanged();
      if (targetStatus === 'VOIDED')
        onVoidAndRebuild?.({code: detail.item.code, name: detail.item.name, shapeKey: detail.item.shapeKey});
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    }
  };
  const confirmStatusChange = (targetStatus: 'ENABLED' | 'DISABLED' | 'ARCHIVED') => {
    if (!detail) return;
    const labels: Record<typeof targetStatus, string> = {ENABLED: '启用', DISABLED: '停用', ARCHIVED: '归档'};
    Modal.confirm({
      title: `${labels[targetStatus]}商品？`,
      content: `将把商品“${detail.item.name}”的生命周期状态改为“${labels[targetStatus]}”，不会清空商品事实。`,
      okText: `确认${labels[targetStatus]}`,
      cancelText: '取消',
      onOk: () => changeStatus(targetStatus),
    });
  };
  const voidAndRebuild = () => {
    if (detail?.item.source === 'TEMPORARY') return;
    if (!detail?.actionAvailability.voidAvailability?.canVoid) return;
    Modal.confirm({
      title: `作废并重建“${detail.item.name}”`,
      content: '将先把旧商品置为作废并释放原编码，然后用相同编码预填新商品创建表单；提交前仍会执行唯一性校验。',
      okText: '作废并继续重建',
      cancelText: '取消',
      onOk: () => changeStatus('VOIDED'),
    });
  };
  const voidSku = (sku: CatalogSkuRow) => {
    if (
      !detail ||
      !itemCode ||
      !canWriteCatalog ||
      detail.item.source === 'TEMPORARY' ||
      detail.item.lifecycle.status === 'VOIDED' ||
      !sku.voidAvailability?.canVoid
    )
      return;
    const blocker = catalogVoidBlockReason(sku.voidAvailability);
    Modal.confirm({
      title: (
        <Space>
          作废 SKU「
          <NameCodeText name={sku.skuName || undefined} code={sku.skuCode || undefined} />
          」？
        </Space>
      ),
      content: blocker
        ? `${blocker} 当前不能作废。`
        : '作废后该 SKU 不再占用商品编码；此操作不可逆，商品其他事实不会被清空。',
      okText: '确认作废 SKU',
      cancelText: '取消',
      okButtonProps: {danger: true},
      onOk: async () => {
        setVoidingSkuRef(sku.productSkuRef);
        setProblem(undefined);
        try {
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          const body = buildCatalogSkuVoidRequest(detail.item, dataNodeRef, itemCode, sku);
          const idempotencyKey = await createContentIdempotencyKey(
            CATALOG_INVENTORY_OPERATION_IDS.saveOperationsCatalogItem,
            body,
          );
          const readback = await save(
            catalogInventoryRtkRequest.saveOperationsCatalogItem(
              {itemCode},
              {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
            ),
          ).unwrap();
          const transitionReadback = readback.result.skuTransitions.find(
            transition => transition.skuRef === sku.productSkuRef,
          );
          setSkusDraft(current =>
            normalizeSkuDraftRows(mergeCatalogSkuVoidReadback(current, sku.productSkuRef, transitionReadback)),
          );
          await detailQuery.refetch();
          onChanged();
        } catch (error) {
          setProblem(operationsProblemOf(error).detail || 'SKU 作废未完成，请刷新后重试。');
        } finally {
          setVoidingSkuRef(undefined);
        }
      },
    });
  };
  const runPromotionPreflight = async (values: PromotionFormValues) => {
    if (!itemCode || !detail) return;
    setPromotion(undefined);
    setPromotionProblem(undefined);
    try {
      const body: TemporaryPromotionPreflightRequest = {
        dataNodeRef: requireOperationsScopeRef(queryContext),
        itemCode,
        formalCode: values.formalCode.trim(),
        shapeKey: values.shapeKey,
        name: values.name.trim(),
        shortName: values.shortName?.trim() || null,
        materialRole: values.materialRole?.trim() || null,
        attributes: detail.item.attributes,
        expectedSourceVersion: detail.item.version,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.preflightOperationsTemporaryCatalogItemPromotion,
        body,
      );
      const response = await preflightPromotion(
        catalogInventoryRtkRequest.preflightOperationsTemporaryCatalogItemPromotion(
          {itemCode},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const value = response.data;
      if (!value) throw new Error('TEMPORARY_PROMOTION_PREFLIGHT_MISSING');
      setPromotion(value);
    } catch (error) {
      setPromotionProblem(operationsProblemOf(error).detail || '临时商品转正预检未完成，请重试。');
    }
  };
  const openPromotion = async () => {
    if (!itemCode || !detail) return;
    const initialValues: PromotionFormValues = {
      formalCode: detail.item.code,
      shapeKey: detail.item.shapeKey as PromotionFormValues['shapeKey'],
      name: detail.item.name,
      shortName: detail.item.shortName ?? '',
      materialRole: '',
    };
    promotionForm.setFieldsValue(initialValues);
    setPromotionOpen(true);
    await runPromotionPreflight(initialValues);
  };
  const executePromotionAction = async () => {
    if (!promotion || !itemCode || !promotion.canPromote || !detail) return;
    try {
      const values = await promotionForm.validateFields();
      const body: TemporaryPromotionExecuteRequest = {
        dataNodeRef: requireOperationsScopeRef(queryContext),
        itemCode,
        formalCode: values.formalCode.trim(),
        shapeKey: values.shapeKey,
        name: values.name.trim(),
        shortName: values.shortName?.trim() || null,
        materialRole: values.materialRole?.trim() || null,
        attributes: detail.item.attributes,
        expectedSourceVersion: promotion.sourceVersion,
        expectedVersion: detail.item.version,
        preflightDigest: promotion.preflightDigest,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.executeOperationsTemporaryCatalogItemPromotion,
        body,
      );
      await executePromotion(
        catalogInventoryRtkRequest.executeOperationsTemporaryCatalogItemPromotion(
          {itemCode},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const codeChanged = values.formalCode.trim() !== detail.item.code;
      setPromotion(undefined);
      setPromotionOpen(false);
      setPromotionProblem(undefined);
      if (codeChanged) onClose();
      else await detailQuery.refetch();
      onChanged();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      setPromotionProblem(
        feedback.errorCode === 'STALE_COPY_PREFLIGHT'
          ? '预检已失效（STALE_COPY_PREFLIGHT），来源或资料已变化，请重新预检。'
          : feedback.detail || '临时商品转正未完成，请重试。',
      );
    }
  };
  const onProductionTagCreated = (candidate: ProductionTagCandidate) => {
    const option: ProductionTagOption = {...candidate};
    setSelectedProductionTags(current =>
      current.some(tag => tag.tagRef === option.tagRef) ? current : [...current, option],
    );
    setSelectedProductionTagRefs(current => (current.includes(option.tagRef) ? current : [...current, option.tagRef]));
    lifecycle.setDirty(true);
    setProductionTagQuickManageOpen(false);
  };
  const openDictionaryQuickManage = (
    kind: CatalogDictionaryQuickManageKind,
    dimensionIndex?: number,
    valueIndex?: number,
  ) =>
    setDictionaryQuickManage({
      kind,
      dimensionIndex,
      valueIndex,
      parentEntryRef:
        kind === 'SKU_ATTRIBUTE_VALUE' && dimensionIndex !== undefined
          ? skuVariantDimensionsDraft[dimensionIndex]?.attributeRef
          : undefined,
    });
  const onDictionaryCreated = (candidate: CatalogDictionaryQuickManageCandidate) => {
    const quickManage = dictionaryQuickManage;
    if (!quickManage) return;
    if (quickManage.kind === 'TAG') {
      setSelectedTagRefs(current =>
        current.includes(candidate.entryRef) ? current : [...current, candidate.entryRef],
      );
    } else if (quickManage.kind === 'SALES_UNIT') {
      setSelectedSalesUnitRefs(current =>
        current.includes(candidate.entryRef) ? current : [...current, candidate.entryRef],
      );
    } else if (quickManage.kind === 'SKU_ATTRIBUTE') {
      if (quickManage.dimensionIndex === undefined) return;
      setSkuVariantDimensionsDraft(current =>
        current.map((dimension, index) =>
          index === quickManage.dimensionIndex
            ? {
                ...dimension,
                attributeRef: draftUuid(candidate.entryRef),
                attributeCode: candidate.code,
                attributeName: candidate.name,
                values: [],
              }
            : dimension,
        ),
      );
    } else if (
      quickManage.kind === 'SKU_ATTRIBUTE_VALUE' &&
      quickManage.dimensionIndex !== undefined &&
      quickManage.valueIndex !== undefined
    ) {
      setSkuVariantDimensionsDraft(current =>
        current.map((dimension, dimensionIndex) =>
          dimensionIndex !== quickManage.dimensionIndex
            ? dimension
            : {
                ...dimension,
                values: dimension.values.map((value, valueIndex) =>
                  valueIndex === quickManage.valueIndex
                    ? {
                        ...value,
                        valueRef: draftUuid(candidate.entryRef),
                        valueCode: candidate.code,
                        valueLabel: candidate.name,
                        status: 'ENABLED',
                      }
                    : value,
                ),
              },
        ),
      );
    }
    setLocalDictionaryRevisions(current => ({...current, [quickManage.kind]: (current[quickManage.kind] ?? 0) + 1}));
    lifecycle.setDirty(true);
    setDictionaryQuickManage(undefined);
  };
  const stageMedia = async (file: File, existingId?: string) => {
    if (!mediaLimits) {
      setMediaProblem('媒体规则尚未加载，请稍后重试。');
      return;
    }
    if (!existingId && mediaDraft.length >= mediaLimits.maxImageCount) {
      setMediaProblem(
        `最多维护 ${mediaLimits.maxImageCount} 张图片（1 张主图 + ${Math.max(mediaLimits.maxImageCount - 1, 0)} 张附图）。`,
      );
      return;
    }
    if (file.size > mediaLimits.maxImageBytes) {
      setMediaProblem(`单张图片不能超过 ${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB。`);
      return;
    }
    const id = existingId ?? globalThis.crypto.randomUUID();
    setMediaProblem(undefined);
    const previous = existingId ? mediaDraft.find(asset => asset.id === existingId) : undefined;
    setMediaDraft(current =>
      existingId
        ? current.map(asset =>
            asset.id === existingId
              ? {
                  ...asset,
                  assetRef: undefined,
                  version: undefined,
                  file,
                  fileName: file.name,
                  mediaType: file.type || 'application/octet-stream',
                  status: 'UPLOADING',
                  error: undefined,
                  staged: true,
                  previous: previous
                    ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
                    : undefined,
                }
              : asset,
          )
        : [
            ...current,
            {
              id,
              file,
              fileName: file.name,
              mediaType: file.type || 'application/octet-stream',
              status: 'UPLOADING',
              staged: true,
            },
          ],
    );
    let stagedMedia: MediaDraft | undefined;
    try {
      const digest = await digestFileContent(file);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {
        dataNodeRef,
        fileName: file.name,
        content: file,
        mediaType: file.type || 'application/octet-stream',
        contentDigest: digest,
      };
      const idempotencyPayload = {
        dataNodeRef,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        contentDigest: digest,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
        idempotencyPayload,
      );
      const response = await stageAsset(
        catalogInventoryRtkRequest.stageOperationsCatalogAsset(
          {},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const readback = response.result;
      if (!readback?.assetRef || !readback.bindGrant) throw new Error('CATALOG_ASSET_STAGE_READBACK_MISSING');
      stagedMedia = {
        id,
        assetRef: readback.assetRef,
        bindGrant: readback.bindGrant,
        fileName: file.name,
        mediaType: readback.mediaType ?? file.type,
        status: 'READY',
        version: readback.version,
        staged: true,
      };
      const previousAsset = previous
        ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
        : undefined;
      if (previousAsset?.staged && previousAsset.assetRef && previousAsset.version !== undefined) {
        if (
          !(await releaseStagedAsset({
            ...previousAsset,
            id: `${id}-previous`,
            fileName: previousAsset.assetRef,
            mediaType: file.type,
            status: 'READY',
          }))
        )
          throw new Error('CATALOG_PREVIOUS_STAGED_ASSET_RELEASE_FAILED');
      }
      setMediaDraft(current =>
        current.map(asset => (asset.id === id ? {...asset, ...stagedMedia, previous: undefined} : asset)),
      );
      lifecycle.setDirty(true);
    } catch (error) {
      if (stagedMedia) await releaseStagedAsset(stagedMedia);
      const previousAsset = previous
        ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged}
        : undefined;
      setMediaDraft(current =>
        current.map(asset =>
          asset.id === id
            ? {
                ...asset,
                assetRef: previousAsset?.assetRef,
                version: previousAsset?.version,
                staged: previousAsset?.staged ?? true,
                previous: undefined,
                status: 'FAILED',
                error: operationsProblemOf(error).detail || '上传失败，请重试。',
              }
            : asset,
        ),
      );
      setMediaProblem(operationsProblemOf(error).detail || '图片上传失败，请重试。');
    }
  };
  const removeMedia = async (id: string, index: number) => {
    if (index === 0 && mediaDraft.length > 1) {
      setMediaProblem('仍有其他图片时，请先指定新的主图。');
      return;
    }
    const asset = mediaDraft.find(entry => entry.id === id);
    if (!asset) return;
    if (!(await releaseStagedAsset(asset))) return;
    setMediaDraft(current => current.filter(asset => asset.id !== id));
    setMediaProblem(undefined);
    lifecycle.setDirty(true);
  };
  const moveMedia = (id: string, offset: -1 | 1) => {
    setMediaDraft(current => {
      const index = current.findIndex(asset => asset.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    lifecycle.setDirty(true);
  };
  const setPrimaryMedia = (id: string) => {
    setMediaDraft(current => {
      const index = current.findIndex(asset => asset.id === id);
      if (index <= 0) return current;
      const next = [...current];
      const [primary] = next.splice(index, 1);
      next.unshift(primary);
      return next;
    });
    lifecycle.setDirty(true);
  };
  const stageSkuMedia = async (file: File, skuIndex: number, replaceAssetRef?: string, retryId?: string) => {
    if (!mediaLimits) {
      setMediaProblem('媒体规则尚未加载，请稍后重试。');
      return;
    }
    const currentSkuMediaCount = skusDraft[skuIndex]?.mediaRefs.length ?? 0;
    if (!replaceAssetRef && !retryId && currentSkuMediaCount >= mediaLimits.maxImageCount) {
      setMediaProblem(`每个 SKU 最多维护 ${mediaLimits.maxImageCount} 张图片。`);
      return;
    }
    if (file.size > mediaLimits.maxImageBytes) {
      setMediaProblem(`单张图片不能超过 ${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB。`);
      return;
    }
    const retry = retryId ? skuStagedMedia.find(asset => asset.id === retryId) : undefined;
    const previousStaged = replaceAssetRef
      ? skuStagedMedia.find(asset => asset.assetRef === replaceAssetRef)
      : undefined;
    const previous =
      retry?.previous ??
      (replaceAssetRef
        ? {assetRef: replaceAssetRef, version: previousStaged?.version, staged: previousStaged?.staged ?? false}
        : undefined);
    const id = retryId ?? globalThis.crypto.randomUUID();
    const pending: MediaDraft = {
      id,
      skuIndex,
      file,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      status: 'UPLOADING',
      staged: true,
      previous,
    };
    setMediaProblem(undefined);
    setSkuStagedMedia(current =>
      retryId ? current.map(asset => (asset.id === retryId ? pending : asset)) : [...current, pending],
    );
    let stagedMedia: MediaDraft | undefined;
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const digest = await digestFileContent(file);
      const body = {
        dataNodeRef,
        fileName: file.name,
        content: file,
        mediaType: file.type || 'application/octet-stream',
        contentDigest: digest,
      };
      const idempotencyPayload = {
        dataNodeRef,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        contentDigest: digest,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.stageOperationsCatalogAsset,
        idempotencyPayload,
      );
      const response = await stageAsset(
        catalogInventoryRtkRequest.stageOperationsCatalogAsset(
          {},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      const readback = response.result;
      if (!readback?.assetRef || !readback.bindGrant) throw new Error('CATALOG_ASSET_STAGE_READBACK_MISSING');
      stagedMedia = {
        ...pending,
        assetRef: readback.assetRef,
        bindGrant: readback.bindGrant,
        mediaType: readback.mediaType ?? file.type,
        status: 'READY',
        version: readback.version,
      };
      const readyMedia = stagedMedia;
      if (previousStaged && !(await releaseStagedAsset(previousStaged))) {
        throw new Error('CATALOG_PREVIOUS_STAGED_ASSET_RELEASE_FAILED');
      }
      setSkusDraft(current =>
        current.map((sku, index) =>
          index !== skuIndex
            ? sku
            : {
                ...sku,
                mediaRefs: replaceAssetRef
                  ? sku.mediaRefs.map(assetRef => (assetRef === replaceAssetRef ? readback.assetRef : assetRef))
                  : [...sku.mediaRefs, readback.assetRef],
              },
        ),
      );
      setSkuStagedMedia(current => [
        ...current.filter(asset => asset.id !== id && asset.assetRef !== previous?.assetRef),
        readyMedia,
      ]);
      lifecycle.setDirty(true);
    } catch (error) {
      if (stagedMedia) await releaseStagedAsset(stagedMedia);
      setSkuStagedMedia(current =>
        current.map(asset =>
          asset.id === id
            ? {
                ...asset,
                assetRef: undefined,
                status: 'FAILED',
                error: operationsProblemOf(error).detail || 'SKU 图片上传失败，请重试。',
              }
            : asset,
        ),
      );
      setMediaProblem(operationsProblemOf(error).detail || 'SKU 图片上传失败，请重试。');
    }
  };
  const removeSkuMedia = async (skuIndex: number, assetRef: string) => {
    const staged = skuStagedMedia.find(asset => asset.assetRef === assetRef);
    if (staged && !(await releaseStagedAsset(staged))) return;
    setSkusDraft(current =>
      current.map((sku, index) =>
        index === skuIndex ? {...sku, mediaRefs: sku.mediaRefs.filter(entry => entry !== assetRef)} : sku,
      ),
    );
    setSkuStagedMedia(current => current.filter(asset => asset.assetRef !== assetRef));
    lifecycle.setDirty(true);
  };
  const removeSkuStagedMedia = (id: string) => setSkuStagedMedia(current => current.filter(asset => asset.id !== id));
  const updateIdentifiers = (next: CatalogIdentifierDraft[]) => {
    setIdentifierDraft(next);
    lifecycle.setDirty(true);
  };
  const updateCategoryRefs = (next: string[]) => {
    setCategoryRefsDraft(next);
    lifecycle.setDirty(true);
  };
  const updateStandardSalePrice = (next: number | null) => {
    setStandardSalePriceDraft(next);
    lifecycle.setDirty(true);
  };
  const updateOrderOptions = (next: CatalogOrderOptionGroupDraft[]) => {
    setOrderOptionsDraft(next);
    lifecycle.setDirty(true);
  };
  const onOrderOptionsChange = updateOrderOptions;
  const updateProductionProfiles = (next: ProductionProfileDraft) => {
    setProductionProfilesDraft(next);
    lifecycle.setDirty(true);
  };
  const updateInventoryBom = (next: CatalogInventoryBomEntry[]) => {
    setInventoryBomDraft(next);
    lifecycle.setDirty(true);
  };
  const updateCompositeGroups = (next: CatalogCompositeGroup[]) => {
    setCompositeGroupsDraft(next);
    lifecycle.setDirty(true);
  };
  const updateSkuVariantDimensions = (next: SkuDimensionDraft[]) => {
    setSkuVariantDimensionsDraft(next);
    lifecycle.setDirty(true);
  };
  const updateSkus = (next: CatalogSkuRow[]) => {
    setSkusDraft(normalizeSkuDraftRows(next));
    lifecycle.setDirty(true);
  };
  const effectiveDictionaryRevision = (kind: DictionaryKind) =>
    (dictionaryRevision[kind] ?? 0) + (localDictionaryRevisions[kind] ?? 0);
  const tabItems = detail
    ? detail.tabs
        .filter(tab => tab.visible)
        .map(tab => ({
          key: tab.tabKey,
          label:
            tab.disabled && tab.reason ? (
              <Tooltip title={tab.reason}>
                <span>{catalogTabLabel(tab.tabKey)}</span>
              </Tooltip>
            ) : (
              catalogTabLabel(tab.tabKey)
            ),
          disabled: tab.disabled,
          children: (
            <CatalogTabContent
              tabKey={tab.tabKey}
              detail={detail}
              manifest={manifest}
              navigation={navigation}
              editing={mode === 'edit'}
              canWriteCatalog={canWriteCatalog}
              form={form}
              mediaDraft={mediaDraft}
              onStageMedia={stageMedia}
              onRemoveMedia={removeMedia}
              onMoveMedia={moveMedia}
              onSetPrimaryMedia={setPrimaryMedia}
              skuStagedMedia={skuStagedMedia}
              onStageSkuMedia={stageSkuMedia}
              onRemoveSkuMedia={removeSkuMedia}
              onRemoveSkuStagedMedia={removeSkuStagedMedia}
              availableProductionTags={availableProductionTags}
              selectedProductionTagRefs={selectedProductionTagRefs}
              selectedProductionTags={selectedProductionTags}
              onProductionTagsChange={next => {
                setSelectedProductionTagRefs(next);
                lifecycle.setDirty(true);
              }}
              selectedTagRefs={selectedTagRefs}
              selectedSalesUnitRefs={selectedSalesUnitRefs}
              onTagRefsChange={next => {
                setSelectedTagRefs(next);
                lifecycle.setDirty(true);
              }}
              onSalesUnitRefsChange={next => {
                setSelectedSalesUnitRefs(next);
                lifecycle.setDirty(true);
              }}
              categoryRefsDraft={categoryRefsDraft}
              onCategoryRefsChange={updateCategoryRefs}
              identifierDraft={identifierDraft}
              createDraftRowId={createDraftRowId}
              standardSalePriceDraft={standardSalePriceDraft}
              orderOptionsDraft={orderOptionsDraft}
              productionProfilesDraft={productionProfilesDraft}
              productionProfileLayer={productionProfileLayer}
              onProductionProfileLayerChange={setProductionProfileLayer}
              inventoryBomDraft={inventoryBomDraft}
              compositeGroupsDraft={compositeGroupsDraft}
              skuVariantDimensionsDraft={skuVariantDimensionsDraft}
              skusDraft={skusDraft}
              queryContext={queryContext}
              brandRef={brandRef}
              currentItemCode={itemCode}
              dictionaryRevision={Object.fromEntries(
                Object.values([
                  'TAG',
                  'SALES_UNIT',
                  'SKU_ATTRIBUTE',
                  'SKU_ATTRIBUTE_VALUE',
                  'PRODUCTION_TAG',
                ] as DictionaryKind[]).map(kind => [kind, effectiveDictionaryRevision(kind)]),
              )}
              onIdentifiersChange={updateIdentifiers}
              onStandardSalePriceChange={updateStandardSalePrice}
              onOrderOptionsChange={onOrderOptionsChange}
              onProductionProfilesChange={updateProductionProfiles}
              onInventoryBomChange={updateInventoryBom}
              onCompositeGroupsChange={updateCompositeGroups}
              onSkuVariantDimensionsChange={updateSkuVariantDimensions}
              onSkusChange={updateSkus}
              onDirty={() => lifecycle.setDirty(true)}
              onOpenProductionTags={onOpenProductionTags}
              onOpenDictionaryQuickManage={openDictionaryQuickManage}
              onOpenProductionQuickManage={() => setProductionTagQuickManageOpen(true)}
              onVoidSku={voidSku}
              voidingSkuRef={voidingSkuRef}
              onNavigateTab={next => setActiveTab(next)}
            />
          ),
        }))
    : [];
  const action = detail?.actionAvailability;
  // AUTO_SYNC is not an all-field read-only mode: the owner supplies the exact
  // deniedFields set, so local supplements (tags, prompts, attributes, etc.)
  // remain editable. Temporary items are the only whole-record read-only mode.
  const sourceLocked = detail ? detail.item.source === 'TEMPORARY' : false;
  const disabledActionReason = (allowed: boolean, label: string, locked = false) => {
    if (locked) return '外部订单临时商品不可直接编辑，请先完成治理转正预检。';
    if (allowed) return undefined;
    if (detail?.item.lifecycle.status === 'VOIDED') return '已作废商品不可继续执行该操作。';
    if (detail?.item.lifecycle.status === 'ARCHIVED' && label !== '归档') return '已归档商品不可执行该操作。';
    return `当前商品状态不允许${label}。`;
  };
  return (
    <Drawer
      title={
        detail ? (
          <Space>
            {detail.item.images[0] && (
              <CatalogAssetPreview
                assetRef={detail.item.images[0]}
                alt={`${detail.item.name}主图`}
                width={40}
                height={40}
                preview={false}
                testId="catalog-item-drawer-thumbnail"
              />
            )}
            <NameCodeText name={detail.item.name} code={detail.item.code} />
            <Tag>{catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)}</Tag>
            <Tag>{catalogEnumLabel(manifest, 'catalogSource', detail.item.source)}</Tag>
            <Tag color={detail.item.lifecycle.status === 'ENABLED' ? 'green' : 'default'}>
              {catalogEnumLabel(manifest, 'catalogItemStatus', detail.item.lifecycle.status)}
            </Tag>
          </Space>
        ) : (
          '商品详情'
        )
      }
      open={Boolean(itemCode)}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!lifecycle.dirty}
      {...adminWideDrawerSurfaceProps}
      {...testId('catalog-inventory-item-drawer')}
      extra={
        detail && (
          <Space>
            {mode === 'view' && canWriteCatalog && (
              <DisabledReasonButton
                disabled={!action?.canEdit || sourceLocked}
                reason={disabledActionReason(Boolean(action?.canEdit), '编辑', sourceLocked)}
                onClick={() => setMode('edit')}
                {...testId('catalog-item-edit')}
              >
                编辑
              </DisabledReasonButton>
            )}
            {mode === 'view' && canWriteCatalog && (
              <DisabledReasonButton
                disabled={!action?.canEnable || sourceLocked}
                reason={disabledActionReason(Boolean(action?.canEnable), '启用', sourceLocked)}
                onClick={() => confirmStatusChange('ENABLED')}
              >
                启用
              </DisabledReasonButton>
            )}
            {mode === 'view' && canWriteCatalog && (
              <DisabledReasonButton
                disabled={!action?.canDisable || sourceLocked}
                reason={disabledActionReason(Boolean(action?.canDisable), '停用', sourceLocked)}
                onClick={() => confirmStatusChange('DISABLED')}
              >
                停用
              </DisabledReasonButton>
            )}
            {mode === 'view' && canWriteCatalog && (
              <DisabledReasonButton
                danger
                disabled={!action?.canArchive || sourceLocked}
                reason={disabledActionReason(Boolean(action?.canArchive), '归档', sourceLocked)}
                onClick={() => confirmStatusChange('ARCHIVED')}
              >
                归档
              </DisabledReasonButton>
            )}
            {mode === 'view' && canWriteCatalog && detail.item.lifecycle.status !== 'VOIDED' && (
              <DisabledReasonButton
                danger
                disabled={!action?.voidAvailability?.canVoid || sourceLocked}
                reason={
                  disabledActionReason(Boolean(action?.voidAvailability?.canVoid), '作废并重建', sourceLocked) ??
                  catalogVoidBlockReason(action?.voidAvailability) ??
                  '当前商品不可执行作废并重建。'
                }
                onClick={voidAndRebuild}
                {...testId('catalog-item-void-and-rebuild')}
              >
                作废并重建
              </DisabledReasonButton>
            )}
            {mode === 'view' &&
              canWriteCatalog &&
              !sourceLocked &&
              detail.item.lifecycle.status !== 'ARCHIVED' &&
              detail.item.lifecycle.status !== 'VOIDED' && (
                <Button onClick={() => setLocalCopyOpen(true)} {...testId('catalog-item-copy-local-open')}>
                  从已有商品复制配置
                </Button>
              )}
            {mode === 'view' && canWriteCatalog && detail.item.source === 'TEMPORARY' && (
              <Button
                loading={preflightPromotionState.isLoading}
                onClick={() => void openPromotion()}
                {...testId('catalog-item-temporary-promotion')}
              >
                治理转正
              </Button>
            )}
            {mode === 'edit' && <Button onClick={lifecycle.requestClose}>取消</Button>}
            {mode === 'edit' && (
              <Button
                type="primary"
                loading={lifecycle.submitting}
                onClick={() => void submit()}
                {...testId('catalog-item-save')}
              >
                保存
              </Button>
            )}
          </Space>
        )
      }
    >
      {detailQuery.isLoading && <Skeleton active {...testId('catalog-item-detail-loading')} />}
      {(problem || detailQuery.error || mediaProblem) && (
        <div ref={problemRef} tabIndex={-1} style={{marginBottom: 16}} {...testId('catalog-item-problem')}>
          <Alert
            type="error"
            showIcon
            title="商品操作未完成"
            description={problem ?? mediaProblem ?? '商品详情暂时无法获取，请重试。'}
            action={
              detailQuery.error ? (
                <Button
                  size="small"
                  onClick={() => void detailQuery.refetch()}
                  {...testId('catalog-item-problem-retry')}
                >
                  重试
                </Button>
              ) : releaseCloseFailed ? (
                <Button
                  size="small"
                  loading={releasingBeforeClose}
                  onClick={() => void closeAfterStagedRelease()}
                  {...testId('catalog-item-release-close-retry')}
                >
                  重试关闭
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      {detail?.item.source === 'AUTO_SYNC' && (
        <Space direction="vertical" size={8} style={{display: 'flex'}}>
          <Alert
            type="info"
            showIcon
            title="自动同步商品"
            description={
              '带锁字段（' +
              (detail.deniedFields.map(field => deniedFieldLabel(manifest, field)).join('、') || '来源声明字段') +
              '）由上游维护；未被锁定的本地补充字段仍可编辑。'
            }
            {...testId('catalog-item-source-auto_sync')}
          />
          <Descriptions
            size="small"
            bordered
            column={3}
            items={[
              {
                key: 'source-order',
                label: '来源订单',
                children: detail.governance.externalIdentity.sourceOrderRef || '—',
              },
              {
                key: 'source-record',
                label: '来源记录',
                children: detail.governance.externalIdentity.sourceRecordRef || '—',
              },
              {
                key: 'source-item',
                label: '来源商品',
                children: detail.governance.externalIdentity.sourceItemRef || '—',
              },
            ]}
            {...testId('catalog-item-source-auto_sync-facts')}
          />
        </Space>
      )}
      {detail?.item.source === 'TEMPORARY' && (
        <>
          <Alert
            type="info"
            showIcon
            title="外部订单临时商品"
            description="该商品可被查看但不可创建销售项；完成资料补齐和转正预检后才可进入正式治理。"
            {...testId('catalog-item-source-temporary')}
          />
          <Card
            size="small"
            title="来源与原始快照"
            style={{marginBottom: 16}}
            {...testId('catalog-item-temporary-source-facts')}
          >
            <Descriptions
              size="small"
              bordered
              column={2}
              items={[
                {key: 'source-order', label: '来源订单', children: detail.item.externalIdentity.sourceOrderRef || '—'},
                {
                  key: 'source-record',
                  label: '来源记录',
                  children: detail.item.externalIdentity.sourceRecordRef || '—',
                },
                {key: 'source-item', label: '来源商品', children: detail.item.externalIdentity.sourceItemRef || '—'},
                {
                  key: 'snapshot-name',
                  label: '原始快照名称',
                  children: detail.item.externalIdentity.snapshot?.name || '—',
                },
                {
                  key: 'snapshot-specification',
                  label: '原始快照规格',
                  children: detail.item.externalIdentity.snapshot?.specification || '—',
                },
                {
                  key: 'snapshot-price',
                  label: '原始快照价格',
                  children: money(detail.item.externalIdentity.snapshot?.price ?? null),
                },
              ]}
            />
          </Card>
        </>
      )}
      {detail && (
        <Space size={8} style={{marginBottom: 12}} {...testId('catalog-item-fact-summary')}>
          <Typography.Text type="secondary">事实摘要</Typography.Text>
          {activeTab === 'basic' ? (
            <Typography.Text type="secondary">分类 {detail.item.categoryRefs.length}</Typography.Text>
          ) : (
            <Button type="link" size="small" onClick={() => setActiveTab('basic')}>
              分类 {detail.item.categoryRefs.length}
            </Button>
          )}
          <Button type="link" size="small" onClick={() => setActiveTab('attributes')}>
            描述属性 {Object.keys(detail.item.attributes).length}
          </Button>
          <Typography.Text type="secondary">
            SKU {detail.item.skuSummary.nonArchivedCount} · 标签 {detail.item.tagRefs.length}
          </Typography.Text>
        </Space>
      )}
      {detail && (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} {...testId('catalog-item-tabs')} />
      )}
      <LocalCatalogCopyDrawer
        open={localCopyOpen}
        sourceItemCode={itemCode ?? ''}
        targetShapeKey={detail?.item.shapeKey}
        queryContext={queryContext}
        brandRef={brandRef}
        onClose={() => setLocalCopyOpen(false)}
        onCompleted={() => {
          setLocalCopyOpen(false);
          void detailQuery.refetch();
          onChanged();
        }}
      />
      <CatalogDictionaryDrawer
        open={productionTagQuickManageOpen}
        initialKind="PRODUCTION_TAG"
        queryContext={queryContext}
        brandRef={brandRef}
        canWrite={canWriteCatalog}
        quickManage
        onCreated={onProductionTagCreated}
        onClose={() => setProductionTagQuickManageOpen(false)}
      />
      <CatalogDictionaryDrawer
        open={Boolean(dictionaryQuickManage)}
        initialKind={dictionaryQuickManage?.kind}
        parentEntryRef={dictionaryQuickManage?.parentEntryRef}
        queryContext={queryContext}
        brandRef={brandRef}
        canWrite={canWriteCatalog}
        quickManage
        onDictionaryCreated={onDictionaryCreated}
        onClose={() => setDictionaryQuickManage(undefined)}
      />
      <Modal
        title="外部订单临时商品转正预检"
        open={promotionOpen}
        onCancel={() => {
          setPromotionOpen(false);
          setPromotion(undefined);
          setPromotionProblem(undefined);
        }}
        okText="确认转正"
        cancelText="返回"
        okButtonProps={{disabled: !promotion?.canPromote, loading: executePromotionState.isLoading}}
        onOk={() => void executePromotionAction()}
        {...testId('catalog-temporary-promotion-preflight')}
      >
        <Space direction="vertical" size={12} style={{display: 'flex'}}>
          {promotionProblem && (
            <Alert
              type="error"
              showIcon
              title="预检未完成"
              description={promotionProblem}
              {...testId('catalog-temporary-promotion-problem')}
            />
          )}
          <Form
            form={promotionForm}
            layout="vertical"
            onValuesChange={() => {
              setPromotion(undefined);
              setPromotionProblem(undefined);
            }}
          >
            <Space align="start" wrap style={{display: 'flex'}}>
              <Form.Item
                label="正式商品编码"
                name="formalCode"
                rules={[{required: true, message: '请输入正式商品编码'}]}
              >
                <Input {...testId('catalog-temporary-promotion-formal-code')} />
              </Form.Item>
              <Form.Item label="商品名称" name="name" rules={[{required: true, message: '请输入商品名称'}]}>
                <Input {...testId('catalog-temporary-promotion-name')} />
              </Form.Item>
              <Form.Item label="短名" name="shortName">
                <Input {...testId('catalog-temporary-promotion-short-name')} />
              </Form.Item>
            </Space>
            <Form.Item label="商品形态" name="shapeKey" rules={[{required: true, message: '请选择商品形态'}]}>
              <Select
                loading={manifestQuery.isLoading}
                options={(manifest?.shapeKeys ?? []).map(value => ({
                  value,
                  label: catalogEnumLabel(manifest, 'shapeKey', value),
                  disabled: value === 'BENEFIT_SHELL',
                }))}
                {...testId('catalog-temporary-promotion-shape')}
              />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(previous, current) => previous.shapeKey !== current.shapeKey}>
              {({getFieldValue}) =>
                getFieldValue('shapeKey') === 'MATERIAL' ? (
                  <Form.Item
                    label="物料角色"
                    name="materialRole"
                    rules={[{required: true, message: '原材料必须填写物料角色'}]}
                  >
                    <Input placeholder="例如：RAW_MATERIAL" {...testId('catalog-temporary-promotion-material-role')} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </Form>
          {promotion && (
            <>
              <Descriptions
                size="small"
                bordered
                items={[
                  {
                    key: 'item',
                    label: '当前临时商品',
                    children: <NameCodeText name={promotion.item.name} code={promotion.item.code} />,
                  },
                  {
                    key: 'proposed',
                    label: '拟转为',
                    children: <NameCodeText name={promotion.proposed.name} code={promotion.proposed.code} />,
                  },
                  {
                    key: 'shape',
                    label: '形态',
                    children: catalogEnumLabel(manifest, 'shapeKey', promotion.proposed.shapeKey),
                  },
                  {
                    key: 'source',
                    label: '来源',
                    children: catalogEnumLabel(manifest, 'catalogSource', promotion.source),
                  },
                  {key: 'sourceVersion', label: '来源版本', children: promotion.sourceVersion},
                  {
                    key: 'code',
                    label: '编码可用性',
                    children: promotion.formalCodeAvailable ? '可用' : '已占用（含历史记录）',
                  },
                  {key: 'status', label: '预检结果', children: promotion.canPromote ? '可转正' : '被阻断'},
                ]}
              />
              {promotion.requiredFields.length > 0 && (
                <Typography.Text type="secondary">
                  本次需确认字段：{promotion.requiredFields.join('、')}
                </Typography.Text>
              )}
              {promotion.changes.length > 0 && (
                <Descriptions
                  size="small"
                  title="差异预览"
                  items={promotion.changes.map(change => ({
                    key: change.field,
                    label: change.field,
                    children: `${change.before ?? '—'} → ${change.after ?? '—'}`,
                  }))}
                />
              )}
              {promotion.blockedReasons.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title="存在阻断原因"
                  description={promotion.blockedReasons.join('；')}
                  {...testId('catalog-temporary-promotion-blocked')}
                />
              )}
              <Typography.Text type="secondary">
                资料补齐与校验通过后才会改变治理状态；若来源版本、正式编码或输入资料变化，必须重新预检，历史引用继续按原快照回放。
              </Typography.Text>
            </>
          )}
          <Button
            onClick={() => {
              void promotionForm
                .validateFields()
                .then(values => runPromotionPreflight(values))
                .catch(() => undefined);
            }}
            loading={preflightPromotionState.isLoading}
            {...testId('catalog-temporary-promotion-re-preflight')}
          >
            重新预检
          </Button>
        </Space>
      </Modal>
    </Drawer>
  );
}

function CatalogTabContent({
  tabKey,
  detail,
  manifest,
  navigation,
  editing,
  canWriteCatalog,
  form,
  mediaDraft,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
  skuStagedMedia,
  onStageSkuMedia,
  onRemoveSkuMedia,
  onRemoveSkuStagedMedia,
  availableProductionTags,
  selectedProductionTagRefs,
  selectedProductionTags,
  onProductionTagsChange,
  selectedTagRefs,
  selectedSalesUnitRefs,
  onTagRefsChange,
  onSalesUnitRefsChange,
  categoryRefsDraft,
  onCategoryRefsChange,
  identifierDraft,
  createDraftRowId,
  standardSalePriceDraft,
  orderOptionsDraft,
  productionProfilesDraft,
  productionProfileLayer,
  onProductionProfileLayerChange,
  inventoryBomDraft,
  compositeGroupsDraft,
  skuVariantDimensionsDraft,
  skusDraft,
  queryContext,
  brandRef,
  currentItemCode,
  dictionaryRevision,
  onIdentifiersChange,
  onStandardSalePriceChange,
  onOrderOptionsChange,
  onProductionProfilesChange,
  onInventoryBomChange,
  onCompositeGroupsChange,
  onSkuVariantDimensionsChange,
  onSkusChange,
  onDirty,
  onOpenProductionTags,
  onOpenDictionaryQuickManage,
  onOpenProductionQuickManage,
  onVoidSku,
  voidingSkuRef,
  onNavigateTab,
}: {
  tabKey: string;
  detail: NonNullable<ReturnType<typeof decodeDetail>>;
  manifest?: CatalogManifest;
  navigation?: CatalogNavigation;
  editing: boolean;
  canWriteCatalog: boolean;
  form: ReturnType<
    typeof Form.useForm<{displayName: string; shortName?: string; attributesDraftRows: CatalogAttributeDraftRow[]}>
  >[0];
  mediaDraft: MediaDraft[];
  onStageMedia: (file: File, existingId?: string) => Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
  skuStagedMedia: MediaDraft[];
  onStageSkuMedia: (file: File, skuIndex: number, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuIndex: number, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  availableProductionTags: ProductionTagOption[];
  selectedProductionTagRefs: string[];
  selectedProductionTags: ProductionTagOption[];
  onProductionTagsChange: (next: string[]) => void;
  selectedTagRefs: string[];
  selectedSalesUnitRefs: string[];
  onTagRefsChange: (next: string[]) => void;
  onSalesUnitRefsChange: (next: string[]) => void;
  categoryRefsDraft: string[];
  onCategoryRefsChange: (next: string[]) => void;
  identifierDraft: CatalogIdentifierDraft[];
  createDraftRowId: (prefix: string) => string;
  standardSalePriceDraft: number | null;
  orderOptionsDraft: CatalogOrderOptionGroupDraft[];
  productionProfilesDraft: ProductionProfileDraft;
  productionProfileLayer: ProfileLayer;
  onProductionProfileLayerChange: (next: ProfileLayer) => void;
  inventoryBomDraft: CatalogInventoryBomEntry[];
  compositeGroupsDraft: CatalogCompositeGroup[];
  skuVariantDimensionsDraft: SkuDimensionDraft[];
  skusDraft: SkuRowDraft[];
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  dictionaryRevision: Partial<Record<DictionaryKind, number>>;
  onIdentifiersChange: (next: CatalogIdentifierDraft[]) => void;
  onStandardSalePriceChange: (next: number | null) => void;
  onOrderOptionsChange: (next: CatalogOrderOptionGroupDraft[]) => void;
  onProductionProfilesChange: (next: ProductionProfileDraft) => void;
  onInventoryBomChange: (next: CatalogInventoryBomEntry[]) => void;
  onCompositeGroupsChange: (next: CatalogCompositeGroup[]) => void;
  onSkuVariantDimensionsChange: (next: SkuDimensionDraft[]) => void;
  onSkusChange: (next: CatalogSkuRow[]) => void;
  onDirty: () => void;
  onOpenProductionTags?: () => void;
  onOpenDictionaryQuickManage: (
    kind: CatalogDictionaryQuickManageKind,
    dimensionIndex?: number,
    valueIndex?: number,
  ) => void;
  onOpenProductionQuickManage: () => void;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
  onNavigateTab: (tabKey: string) => void;
}) {
  const denied = (fieldKey: string) => detail.deniedFields.includes(fieldKey);
  const fieldLabel = (fieldKey: string) => (
    <Space size={4}>
      <span>{catalogFieldLabel(manifest, fieldKey)}</span>
      {denied(fieldKey) && <span aria-label="由来源锁定">🔒</span>}
    </Space>
  );
  const locked = (fieldKey: string) =>
    denied(fieldKey) && (
      <Alert
        type="info"
        showIcon
        title={`${catalogFieldLabel(manifest, fieldKey)}由来源维护`}
        description="当前只读；如需修改请在来源系统处理。"
        style={{marginBottom: 12}}
      />
    );
  const categoryNodes = categoryRefsDraft
    .map(categoryRef => navigation?.tree.find(node => node.categoryRef === categoryRef))
    .filter((node): node is CatalogNavigation['tree'][number] => Boolean(node));
  const categorySummary =
    categoryRefsDraft.length === 0 ? (
      <Typography.Text type="secondary">未分类</Typography.Text>
    ) : !navigation ? (
      <Typography.Text type="secondary">分类信息加载中</Typography.Text>
    ) : categoryNodes.length === categoryRefsDraft.length ? (
      <Space wrap>
        {categoryNodes.map(node => (
          <NameCodeText key={node.categoryRef} name={node.name} code={node.code} />
        ))}
      </Space>
    ) : (
      <Typography.Text type="secondary">分类信息暂不可用（{categoryRefsDraft.length} 个引用）</Typography.Text>
    );
  const referencePickerContexts = useMemo(
    () =>
      ({
        TAG: {
          scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
          readField: () => undefined,
          readSection: () => [],
          sectionRevision: () => `${detail.item.version}:${dictionaryRevision.TAG ?? 0}`,
        },
        SALES_UNIT: {
          scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
          readField: () => undefined,
          readSection: () => [],
          sectionRevision: () => `${detail.item.version}:${dictionaryRevision.SALES_UNIT ?? 0}`,
        },
      }) satisfies Record<'TAG' | 'SALES_UNIT', CatalogFieldRuntimeContext>,
    [brandRef, detail.item.version, dictionaryRevision.SALES_UNIT, dictionaryRevision.TAG, queryContext.scopeRef],
  );
  if (tabKey === 'basic' && editing)
    return (
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        <Descriptions
          size="small"
          bordered
          title="商品事实摘要"
          items={[
            {
              key: 'itemKind',
              label: '商品类型',
              children: catalogEnumLabel(manifest, 'itemKind', detail.item.itemKind),
            },
            {
              key: 'measureMode',
              label: '计量模式',
              children: catalogEnumLabel(manifest, 'measureMode', detail.item.measureMode),
            },
            {
              key: 'usageCapabilities',
              label: '使用能力',
              children:
                detail.item.usageCapabilities
                  .map(value => catalogEnumLabel(manifest, 'usageCapability', value))
                  .join('、') || '—',
            },
          ]}
          {...testId('catalog-item-edit-derived-facts')}
        />
        <Form form={form} layout="vertical" onValuesChange={onDirty}>
          <Alert type="info" showIcon title="商品编码与形态创建后不可修改" style={{marginBottom: 16}} />
          <Form.Item
            label={fieldLabel('name')}
            name="displayName"
            rules={[{required: true, message: '请输入商品名称'}]}
          >
            <Input disabled={denied('name')} {...testId('catalog-item-edit-name')} />
          </Form.Item>
          <Form.Item label={fieldLabel('shortName')} name="shortName">
            <Input
              disabled={denied('shortName')}
              placeholder="用于列表或小票的短展示名"
              {...testId('catalog-item-edit-short-name')}
            />
          </Form.Item>
          <CatalogCategoryDescriptorField
            manifest={manifest}
            shapeKey={detail.item.shapeKey}
            value={categoryRefsDraft}
            denied={detail.deniedFields.includes('categoryRefs')}
            scopeRef={queryContext.scopeRef}
            brandRef={brandRef}
            version={detail.item.version}
            onChange={onCategoryRefsChange}
            onDirty={onDirty}
          />
          {locked('categoryRefs')}
          <CatalogDescriptorPicker
            manifest={manifest}
            shapeKey={detail.item.shapeKey}
            fieldKey="tagRefs"
            value={selectedTagRefs}
            context={referencePickerContexts.TAG}
            disabled={denied('tagRefs')}
            actions={
              <Button
                size="small"
                disabled={denied('tagRefs')}
                onClick={() => onOpenDictionaryQuickManage('TAG')}
                {...testId('catalog-item-tag-manage')}
              >
                维护商品标签
              </Button>
            }
            testIdValue="catalog-item-tag-refs"
            onChange={next => onTagRefsChange(Array.isArray(next) ? next : next ? [next] : [])}
          />
          {locked('tagRefs')}
          <CatalogDescriptorPicker
            manifest={manifest}
            shapeKey={detail.item.shapeKey}
            fieldKey="salesUnitRefs"
            value={selectedSalesUnitRefs}
            context={referencePickerContexts.SALES_UNIT}
            disabled={denied('salesUnitRefs')}
            actions={
              <Button
                size="small"
                disabled={denied('salesUnitRefs')}
                onClick={() => onOpenDictionaryQuickManage('SALES_UNIT')}
                {...testId('catalog-item-sales-unit-manage')}
              >
                维护销售单位
              </Button>
            }
            testIdValue="catalog-item-sales-unit-refs"
            onChange={next => onSalesUnitRefsChange(Array.isArray(next) ? next : next ? [next] : [])}
          />
          {locked('salesUnitRefs')}
          {detail.item.priceGranularity === 'ITEM' ? (
            <Form.Item label={fieldLabel('standardSalePrice')}>
              <InputNumber
                min={0}
                precision={0}
                value={standardSalePriceDraft}
                disabled={denied('standardSalePrice')}
                onChange={value => onStandardSalePriceChange(value ?? null)}
                style={{width: '100%'}}
                {...testId('catalog-item-edit-standard-price')}
              />
            </Form.Item>
          ) : (
            <Typography.Text type="secondary">标准价按 SKU 矩阵维护。</Typography.Text>
          )}
        </Form>
        {denied('images') ? (
          locked('images')
        ) : (
          <CatalogAssetEditor
            mediaDraft={mediaDraft}
            mediaLimits={decodeCatalogMediaLimits(manifest)}
            onStageMedia={onStageMedia}
            onRemoveMedia={onRemoveMedia}
            onMoveMedia={onMoveMedia}
            onSetPrimaryMedia={onSetPrimaryMedia}
          />
        )}
      </Space>
    );
  if (tabKey === 'basic')
    return (
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {key: 'name', label: '商品名称', children: detail.item.name},
            {key: 'shortName', label: '短名', children: detail.item.shortName || '—'},
            {key: 'code', label: '商品编码', children: detail.item.code},
            {key: 'shape', label: '商品形态', children: catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)},
            {
              key: 'status',
              label: '状态',
              children: catalogEnumLabel(manifest, 'catalogItemStatus', detail.item.lifecycle.status),
            },
            {key: 'kind', label: '商品类型', children: catalogEnumLabel(manifest, 'itemKind', detail.item.itemKind)},
            {
              key: 'measure',
              label: '计量模式',
              children: catalogEnumLabel(manifest, 'measureMode', detail.item.measureMode),
            },
            {
              key: 'capabilities',
              label: '使用能力',
              children:
                detail.item.usageCapabilities
                  .map(value => catalogEnumLabel(manifest, 'usageCapability', value))
                  .join('、') || '—',
            },
            ...(detail.item.shapeKey === 'MATERIAL'
              ? [{key: 'materialRole', label: '物料角色', children: detail.item.materialRole || '—'}]
              : []),
            {
              key: 'priceGranularity',
              label: '价格粒度',
              children: catalogEnumLabel(manifest, 'priceGranularity', detail.item.priceGranularity),
            },
            {key: 'standardPrice', label: '商品标准价', children: money(detail.item.standardSalePrice ?? null)},
            {key: 'missingPrice', label: '缺价数', children: detail.item.missingPriceCount},
            {key: 'version', label: '版本', children: detail.item.version},
            {
              key: 'categories',
              label: '分类',
              children: <span {...testId('catalog-item-category-refs-readonly')}>{categorySummary}</span>,
            },
            {
              key: 'attributes',
              label: '描述属性',
              children: (
                <Button type="link" size="small" onClick={() => onNavigateTab('attributes')}>
                  {Object.keys(detail.item.attributes).length} 个属性
                </Button>
              ),
            },
          ]}
        />
        <CatalogDescriptorPicker
          manifest={manifest}
          shapeKey={detail.item.shapeKey}
          fieldKey="tagRefs"
          value={selectedTagRefs}
          context={referencePickerContexts.TAG}
          readOnly
          testIdValue="catalog-item-tag-refs-readonly"
          onChange={() => undefined}
        />
        <CatalogDescriptorPicker
          manifest={manifest}
          shapeKey={detail.item.shapeKey}
          fieldKey="salesUnitRefs"
          value={selectedSalesUnitRefs}
          context={referencePickerContexts.SALES_UNIT}
          readOnly
          testIdValue="catalog-item-sales-unit-refs-readonly"
          onChange={() => undefined}
        />
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {
              key: 'images',
              label: '图片资产',
              children: <CatalogAssetGallery assetRefs={detail.item.images} itemName={detail.item.name} />,
            },
          ]}
        />
      </Space>
    );
  if (tabKey === 'identifiers' && editing)
    return denied('identifiers') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('identifiers')}
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={identifierDraft.map((entry, index) => ({
            key: `${entry.kind}-${index}`,
            label: entry.kind,
            children: (
              <Space>
                <NameCodeText name={entry.value} code={entry.code} />
                <Tag>绑定范围：商品</Tag>
              </Space>
            ),
          }))}
        />
      </Space>
    ) : (
      <IdentifierEditor
        values={identifierDraft}
        createDraftRowId={createDraftRowId}
        onChange={onIdentifiersChange}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'identifiers')
    return detail.item.identifiers.length ? (
      <Descriptions
        {...adminWideDetailDescriptionsProps}
        items={detail.item.identifiers.map((entry, index) => ({
          key: `${entry.kind}-${index}`,
          label: entry.kind,
          children: (
            <Space>
              <NameCodeText name={entry.value} code={entry.code} />
              <Tag>绑定范围：商品</Tag>
            </Space>
          ),
        }))}
      />
    ) : (
      <EmptySection text="未维护条码与识别码" />
    );
  if (tabKey === 'sku-specifications-pricing' && editing)
    return denied('skus') || denied('skuVariantDimensions') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {denied('skuVariantDimensions') && locked('skuVariantDimensions')}
        {denied('skus') && locked('skus')}
        <SkuMatrixReadOnly
          manifest={manifest}
          dimensions={detail.item.skuVariantDimensions}
          skus={detail.item.skus}
          summary={detail.item.skuSummary}
          priceGranularity={detail.item.priceGranularity}
          standardSalePrice={detail.item.standardSalePrice}
          missingPriceCount={detail.item.missingPriceCount}
          canWriteCatalog={canWriteCatalog}
          onVoidSku={onVoidSku}
          voidingSkuRef={voidingSkuRef}
        />
      </Space>
    ) : (
      <SkuMatrixEditor
        manifest={manifest}
        dimensions={skuVariantDimensionsDraft}
        skus={skusDraft}
        priceGranularity={detail.item.priceGranularity}
        skuStagedMedia={skuStagedMedia}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        version={detail.item.version}
        dictionaryRevision={dictionaryRevision.SKU_ATTRIBUTE ?? 0}
        valueDictionaryRevision={dictionaryRevision.SKU_ATTRIBUTE_VALUE ?? 0}
        onOpenDictionary={kind => onOpenDictionaryQuickManage(kind)}
        onOpenValueDictionary={(dimensionIndex, valueIndex) =>
          onOpenDictionaryQuickManage('SKU_ATTRIBUTE_VALUE', dimensionIndex, valueIndex)
        }
        onDimensionsChange={onSkuVariantDimensionsChange}
        onSkusChange={onSkusChange}
        onStageSkuMedia={onStageSkuMedia}
        onRemoveSkuMedia={onRemoveSkuMedia}
        onRemoveSkuStagedMedia={onRemoveSkuStagedMedia}
        canWriteCatalog={canWriteCatalog}
        onVoidSku={onVoidSku}
        voidingSkuRef={voidingSkuRef}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'sku-specifications-pricing')
    return (
      <SkuMatrixReadOnly
        manifest={manifest}
        dimensions={detail.item.skuVariantDimensions}
        skus={detail.item.skus}
        summary={detail.item.skuSummary}
        priceGranularity={detail.item.priceGranularity}
        standardSalePrice={detail.item.standardSalePrice}
        missingPriceCount={detail.item.missingPriceCount}
        canWriteCatalog={canWriteCatalog}
        onVoidSku={onVoidSku}
        voidingSkuRef={voidingSkuRef}
      />
    );
  if (tabKey === 'attributes' && editing)
    return denied('attributes') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('attributes')}
        <FactMap value={detail.item.attributes} empty="未维护描述属性" />
      </Space>
    ) : (
      <Form form={form} layout="vertical" onValuesChange={onDirty}>
        <Form.Item
          label={fieldLabel('attributes')}
          name="attributesDraftRows"
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            {
              validator: (_, value: CatalogAttributeDraftRow[] | undefined) => {
                const duplicates = duplicateCatalogAttributeKeys(value ?? []);
                return duplicates.length
                  ? Promise.reject(new Error('属性键重复：' + duplicates.join('、')))
                  : Promise.resolve();
              },
            },
          ]}
        >
          <AttributesKeyValueEditor onDirty={onDirty} {...testId('catalog-item-edit-attributes')} />
        </Form.Item>
      </Form>
    );
  if (tabKey === 'attributes') return <FactMap value={detail.item.attributes} empty="未维护描述属性" />;
  if (tabKey === 'order-options' && editing)
    return denied('orderOptions') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('orderOptions')}
        <OrderOptionsReadOnly values={detail.orderOptions} />
      </Space>
    ) : (
      <OrderOptionsEditor
        values={orderOptionsDraft}
        createDraftRowId={createDraftRowId}
        onChange={onOrderOptionsChange}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'order-options') return <OrderOptionsReadOnly values={detail.orderOptions} />;
  if (tabKey === 'production-prompts') {
    const detailProductionTags: ProductionTagOption[] = detail.productionTags.map(tag => ({...tag}));
    const tagMap = new Map<string, ProductionTagOption>(
      [...detailProductionTags, ...availableProductionTags, ...selectedProductionTags].map(tag => [tag.tagRef, tag]),
    );
    const selectedTags = selectedProductionTagRefs.map(
      tagRef => tagMap.get(tagRef) ?? {tagRef, code: '', name: '', owner: 'fulfillment-production'},
    );
    const options = Array.from(tagMap.values()).map(tag => ({
      label: tag.name || tag.code || tag.tagRef,
      value: tag.tagRef,
      disabled: tag.status !== undefined && tag.status !== 'ENABLED',
    }));
    return (
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {editing && canWriteCatalog ? (
          <>
            <Typography.Text strong>{fieldLabel('productionTagRefs')}</Typography.Text>
            <Select
              mode="multiple"
              value={selectedProductionTagRefs}
              options={options}
              disabled={denied('productionTagRefs')}
              placeholder={catalogFieldLabel(manifest, 'productionTagRefs')}
              onChange={onProductionTagsChange}
              style={{width: '100%'}}
              {...testId('catalog-production-tag-field')}
            />
            {locked('productionTagRefs')}
          </>
        ) : (
          <Space wrap>
            {selectedTags.length ? (
              selectedTags.map(tag => <Tag key={tag.tagRef}>{tag.name || tag.code || '未命名标签'}</Tag>)
            ) : (
              <EmptySection text="未维护生产提示或商品处理标签" />
            )}
          </Space>
        )}
        {canWriteCatalog && editing && (
          <Button
            disabled={denied('productionTagRefs')}
            onClick={onOpenProductionQuickManage}
            {...testId('catalog-production-tag-quick-manage')}
          >
            快速创建商品处理标签
          </Button>
        )}
        {!editing && onOpenProductionTags && (
          <Button type="link" onClick={onOpenProductionTags} {...testId('catalog-production-tag-owner-open')}>
            打开生产履约标签维护
          </Button>
        )}
        {editing && !denied('productionProfiles') ? (
          <ProductionProfileEditor
            layer={productionProfileLayer}
            profiles={productionProfilesDraft}
            onLayerChange={onProductionProfileLayerChange}
            onChange={onProductionProfilesChange}
            onDirty={onDirty}
          />
        ) : (
          <>
            {denied('productionProfiles') && locked('productionProfiles')}
            <ProductionProfilesReadOnly profiles={detail.item.productionProfiles} />
          </>
        )}
      </Space>
    );
  }
  if (tabKey === 'inventory-bom' && editing)
    return denied('inventoryBom') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('inventoryBom')}
        <InventoryBomReadOnly manifest={manifest} values={detail.inventoryBom} />
      </Space>
    ) : (
      <InventoryBomEditor
        manifest={manifest}
        shapeKey={detail.item.shapeKey}
        values={inventoryBomDraft}
        orderOptions={orderOptionsDraft}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        version={detail.item.version}
        onChange={onInventoryBomChange}
        onDirty={onDirty}
      />
    );
  if (tabKey === 'inventory-bom') return <InventoryBomReadOnly manifest={manifest} values={detail.inventoryBom} />;
  if (tabKey === 'composite-content' && editing)
    return denied('compositeGroups') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('compositeGroups')}
        <CompositeGroupsReadOnly values={detail.compositeGroups} />
      </Space>
    ) : (
      <CompositeGroupsEditor
        manifest={manifest}
        shapeKey={detail.item.shapeKey}
        values={compositeGroupsDraft}
        onChange={onCompositeGroupsChange}
        onDirty={onDirty}
        queryContext={queryContext}
        brandRef={brandRef}
        currentItemCode={currentItemCode}
        version={detail.item.version}
      />
    );
  if (tabKey === 'composite-content') return <CompositeGroupsReadOnly values={detail.compositeGroups} />;
  if (tabKey === 'governance')
    return (
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {key: 'shape', label: '商品形态', children: catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)},
            {
              key: 'status',
              label: '生命周期状态',
              children: catalogEnumLabel(manifest, 'catalogItemStatus', detail.item.lifecycle.status),
            },
            {key: 'version', label: '版本', children: detail.item.version},
            {
              key: 'source-order',
              label: '来源订单',
              children: detail.governance.externalIdentity.sourceOrderRef || '—',
            },
            {
              key: 'source-record',
              label: '来源记录',
              children: detail.governance.externalIdentity.sourceRecordRef || '—',
            },
            {key: 'source-item', label: '来源商品', children: detail.governance.externalIdentity.sourceItemRef || '—'},
            {
              key: 'references',
              label: `引用关系（${detail.references.length}）`,
              children: detail.references.length
                ? detail.references
                    .map(entry => `${entry.direction} · ${entry.referenceKind}:${entry.code || entry.referenceRef}`)
                    .join('、')
                : '无引用',
            },
            {
              key: 'denied-fields',
              label: '上游锁定字段',
              children: detail.deniedFields.length ? (
                <Space wrap>
                  {detail.deniedFields.map(field => (
                    <Tag key={field} color="gold">
                      {deniedFieldLabel(manifest, field)}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '无锁定字段'
              ),
            },
          ]}
        />
        {!detail.actionAvailability.voidAvailability?.canVoid && (
          <Alert
            type="warning"
            showIcon
            title="当前不可作废"
            description={catalogVoidBlockReason(detail.actionAvailability.voidAvailability)}
            {...testId('catalog-item-void-block-reasons')}
          />
        )}
      </Space>
    );
  return <EmptySection text={editing ? '当前页暂不支持编辑。' : `${catalogTabLabel(tabKey)}尚未维护`} />;
}

function CatalogCategoryDescriptorField({
  manifest,
  shapeKey,
  value,
  denied,
  scopeRef,
  brandRef,
  version,
  onChange,
  onDirty,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  value: string[];
  denied: boolean;
  scopeRef?: string;
  brandRef?: string;
  version: number;
  onChange: (next: string[]) => void;
  onDirty: () => void;
}) {
  const field = useMemo(
    () => catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, 'categoryRefs'),
    [manifest, shapeKey],
  );
  const renderedField = field && denied ? {...field, readonly: true} : field;
  const source = field?.optionSourceRef;
  const resolver = useMemo(() => createCatalogOptionResolver(), []);
  const context = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
      readField: () => undefined,
      readSection: () => [],
      sectionRevision: () => version,
    }),
    [brandRef, scopeRef, version],
  );
  const [treeData, setTreeData] = useState<DescriptorTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    if (!field || !source) {
      setTreeData([]);
      setError('分类信息暂不可用，请稍后重试。');
      return () => {
        cancelled = true;
      };
    }
    if (!scopeRef) {
      setTreeData([]);
      setError('请先选择可查看范围，再加载分类。');
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(undefined);
    void resolver(source, context)
      .then(result => {
        if (cancelled || result.stale) return;
        setTreeData(result.treeData);
      })
      .catch(() => {
        if (!cancelled) {
          setTreeData([]);
          setError('分类候选加载失败，请重试。');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [context, field, resolver, scopeRef, source]);
  if (!renderedField)
    return <Alert type="error" showIcon title="分类信息暂不可用" {...testId('catalog-item-category-field-error')} />;
  return (
    <div {...testId('catalog-item-category-field')}>
      <DescriptorFieldRenderer
        field={renderedField}
        value={value}
        treeData={treeData}
        optionLoading={loading}
        optionError={error}
        onChange={next => {
          onChange(Array.isArray(next) ? next.map(String) : []);
          onDirty();
        }}
      />
    </div>
  );
}

function IdentifierEditor({
  values,
  createDraftRowId,
  onChange,
  onDirty,
}: {
  values: CatalogIdentifierDraft[];
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogIdentifierDraft[]) => void;
  onDirty: () => void;
}) {
  const update = (index: number, patch: Partial<CatalogDetail['item']['identifiers'][number]>) =>
    onChange(values.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-identifiers-editor')}>
      <Alert type="info" showIcon title="按 SKU 管理商品的识别码应在 SKU 矩阵中维护；本页仅维护商品级识别码。" />
      <Button
        onClick={() => {
          onChange([...values, {editorId: createDraftRowId('identifier'), kind: 'BARCODE', code: '', value: ''}]);
          onDirty();
        }}
        {...testId('catalog-item-identifier-add')}
      >
        新增识别码
      </Button>
      {values.length === 0 && <EmptySection text="未维护识别码，可新增一行" />}
      {values.map((entry, index) => (
        <Card
          key={entry.editorId}
          size="small"
          title={`识别码 ${index + 1}`}
          extra={
            <Button
              danger
              type="link"
              onClick={() => {
                onChange(values.filter((_, entryIndex) => entryIndex !== index));
                onDirty();
              }}
              {...testId(`catalog-item-identifier-remove-${index}`)}
            >
              移除
            </Button>
          }
        >
          <Space wrap>
            <Input
              addonBefore="类型"
              value={entry.kind}
              onChange={event => {
                update(index, {kind: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-identifier-kind-${index}`)}
            />
            <Input
              addonBefore="编码"
              value={entry.code}
              onChange={event => {
                update(index, {code: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-identifier-code-${index}`)}
            />
            <Input
              addonBefore="识别码"
              value={entry.value}
              onChange={event => {
                update(index, {value: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-identifier-value-${index}`)}
            />
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function skuCombinationKeyForFeedback(sku: SkuRowDraft) {
  return sku.attributeValueRefs
    .map(value => value.attributeRef + ':' + value.attributeValueRef)
    .sort()
    .join('|');
}

type SkuDraftIssueCode = ReturnType<typeof catalogSkuIssueCodes>[number];
const skuIssueLabels: Record<SkuDraftIssueCode, string> = {
  MISSING_CODE: '缺少 SKU 编码',
  MISSING_NAME: '缺少 SKU 名称',
  MISSING_SKU_PRICE: '缺少 SKU 标准价',
  DUPLICATE_CODE: 'SKU 编码重复',
  DUPLICATE_COMBINATION: '属性组合重复',
};

function SkuFieldFeedback({message, children}: {message?: string; children: ReactNode}) {
  return (
    <Space direction="vertical" size={2} style={{display: 'inline-flex', verticalAlign: 'top'}}>
      <div>{children}</div>
      {message && (
        <Typography.Text type="danger" style={{fontSize: 12}}>
          {message}
        </Typography.Text>
      )}
    </Space>
  );
}

function SkuMatrixEditor({
  manifest,
  dimensions,
  skus,
  priceGranularity,
  skuStagedMedia,
  scopeRef,
  brandRef,
  version,
  dictionaryRevision,
  valueDictionaryRevision,
  onOpenDictionary,
  onOpenValueDictionary,
  onDimensionsChange,
  onSkusChange,
  onStageSkuMedia,
  onRemoveSkuMedia,
  onRemoveSkuStagedMedia,
  canWriteCatalog,
  onVoidSku,
  voidingSkuRef,
  onDirty,
}: {
  manifest?: CatalogManifest;
  dimensions: SkuDimensionDraft[];
  skus: SkuRowDraft[];
  priceGranularity: string;
  skuStagedMedia: MediaDraft[];
  scopeRef?: string;
  brandRef?: string;
  version: number;
  dictionaryRevision: number;
  valueDictionaryRevision: number;
  onOpenDictionary?: (kind: 'SKU_ATTRIBUTE') => void;
  onOpenValueDictionary?: (dimensionIndex: number, valueIndex: number) => void;
  onDimensionsChange: (next: SkuDimensionDraft[]) => void;
  onSkusChange: (next: CatalogSkuRow[]) => void;
  onStageSkuMedia: (file: File, skuIndex: number, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuIndex: number, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  canWriteCatalog: boolean;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
  onDirty: () => void;
}) {
  const fieldLabel = (fieldKey: string) => catalogFieldLabel(manifest, fieldKey);
  const mediaLimits = decodeCatalogMediaLimits(manifest);
  const attributePickerContext = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
      readField: () => undefined,
      readSection: () => [],
      sectionRevision: () => `${version}:${dictionaryRevision}`,
    }),
    [brandRef, dictionaryRevision, scopeRef, version],
  );
  const valuePickerContexts = useMemo(
    () =>
      dimensions.map(
        dimension =>
          ({
            scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
            readField: (fieldKey: string) => (fieldKey === 'skuVariantAttribute' ? dimension.attributeRef : undefined),
            readSection: () => [],
            sectionRevision: () => `${version}:${valueDictionaryRevision}:${dimension.attributeRef}`,
          }) satisfies CatalogFieldRuntimeContext,
      ),
    [brandRef, dimensions, scopeRef, valueDictionaryRevision, version],
  );
  const combinationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    skus.forEach(sku => {
      const key = skuCombinationKeyForFeedback(sku);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [skus]);
  const skuCodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    skus.forEach(sku => {
      const code = sku.skuCode.trim();
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
    });
    return counts;
  }, [skus]);
  const applyDimensions = (next: SkuDimensionDraft[]) => {
    onDimensionsChange(next);
    onSkusChange(buildSkuMatrix(next, skus));
    onDirty();
  };
  const updateDimension = (index: number, patch: Partial<SkuDimensionDraft>) =>
    applyDimensions(dimensions.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  const updateDimensionValue = (
    dimensionIndex: number,
    valueIndex: number,
    patch: Partial<SkuDimensionDraft['values'][number]>,
  ) =>
    applyDimensions(
      dimensions.map((entry, entryIndex) =>
        entryIndex === dimensionIndex
          ? {
              ...entry,
              values: entry.values.map((value, index) => (index === valueIndex ? {...value, ...patch} : value)),
            }
          : entry,
      ),
    );
  const updateSku = (index: number, patch: Partial<SkuRowDraft>) =>
    onSkusChange(skus.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  const regenerateMatrix = () => {
    onSkusChange(buildSkuMatrix(dimensions, skus));
    onDirty();
  };
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-sku-matrix-editor')}>
      <Alert type="info" showIcon title="SKU 编码创建后不可修改；属性值请从已有销售属性中选择。" />
      <Card
        size="small"
        title="规格维度"
        extra={
          <Space>
            <Button
              size="small"
              disabled={dimensions.length === 0}
              onClick={regenerateMatrix}
              {...testId('catalog-item-sku-matrix-regenerate')}
            >
              按维度生成矩阵
            </Button>
            <Button
              size="small"
              onClick={() =>
                applyDimensions([
                  ...dimensions,
                  {attributeRef: draftUuid(), attributeCode: '', attributeName: '', values: []},
                ])
              }
              {...testId('catalog-item-sku-dimension-add')}
            >
              新增规格维度
            </Button>
          </Space>
        }
      >
        {dimensions.length === 0 && <EmptySection text="未维护 SKU 规格维度" />}
        <Space direction="vertical" size={10} style={{display: 'flex'}}>
          {dimensions.map((dimension, dimensionIndex) => (
            <Card
              key={`${dimension.attributeRef}-${dimensionIndex}`}
              size="small"
              title={`维度 ${dimensionIndex + 1}`}
              extra={
                <Button
                  danger
                  type="link"
                  onClick={() => applyDimensions(dimensions.filter((_, index) => index !== dimensionIndex))}
                  {...testId(`catalog-item-sku-dimension-remove-${dimensionIndex}`)}
                >
                  移除
                </Button>
              }
            >
              <CatalogDescriptorPicker
                manifest={manifest}
                shapeKey="SKU_VARIANT_SALE_COUNTED"
                fieldKey="skuVariantAttribute"
                value={String(dimension.attributeRef ?? '')}
                context={attributePickerContext}
                actions={
                  onOpenDictionary && (
                    <Button
                      size="small"
                      onClick={() => onOpenDictionary('SKU_ATTRIBUTE')}
                      {...testId(`catalog-item-sku-dimension-attribute-manage-${dimensionIndex}`)}
                    >
                      维护 SKU 销售属性
                    </Button>
                  )
                }
                testIdValue={`catalog-item-sku-dimension-attribute-${dimensionIndex}`}
                onChange={(next, rawRow) => {
                  const row = descriptorRow(rawRow);
                  updateDimension(dimensionIndex, {
                    attributeRef: draftUuid(descriptorString(next)),
                    attributeCode: typeof row?.code === 'string' ? row.code : '',
                    attributeName: typeof row?.name === 'string' ? row.name : '',
                    values: [],
                  });
                }}
              />
              <Divider style={{margin: '8px 0'}} />
              <Button
                size="small"
                disabled={!dimension.attributeRef}
                onClick={() =>
                  updateDimension(dimensionIndex, {
                    values: [
                      ...dimension.values,
                      {
                        valueRef: draftUuid(),
                        valueCode: '',
                        valueLabel: '',
                        displayOrder: dimension.values.length,
                        status: 'ENABLED',
                      },
                    ],
                  })
                }
                {...testId(`catalog-item-sku-dimension-value-add-${dimensionIndex}`)}
              >
                新增属性值引用
              </Button>
              <Space direction="vertical" size={6} style={{display: 'flex', marginTop: 8}}>
                {dimension.values.map((value, valueIndex) => (
                  <Space key={`${value.valueCode}-${valueIndex}`} wrap>
                    <CatalogDescriptorPicker
                      manifest={manifest}
                      shapeKey="SKU_VARIANT_SALE_COUNTED"
                      fieldKey="skuVariantValues"
                      value={String(value.valueRef ?? '')}
                      context={valuePickerContexts[dimensionIndex]}
                      disabled={!dimension.attributeRef}
                      disabledMessage={!dimension.attributeRef ? '请先选择 SKU 销售属性，再选择属性值。' : undefined}
                      actions={
                        onOpenValueDictionary && (
                          <Button
                            size="small"
                            disabled={!dimension.attributeRef}
                            onClick={() => onOpenValueDictionary(dimensionIndex, valueIndex)}
                            {...testId(`catalog-item-sku-dimension-value-manage-${dimensionIndex}-${valueIndex}`)}
                          >
                            维护属性值
                          </Button>
                        )
                      }
                      testIdValue={`catalog-item-sku-dimension-value-${dimensionIndex}-${valueIndex}`}
                      onChange={(next, rawRow) => {
                        const row = descriptorRow(rawRow);
                        updateDimensionValue(dimensionIndex, valueIndex, {
                          valueRef: draftUuid(descriptorString(next)),
                          valueCode: typeof row?.code === 'string' ? row.code : '',
                          valueLabel: typeof row?.name === 'string' ? row.name : '',
                          status: typeof row?.status === 'string' ? row.status : 'ENABLED',
                        });
                        onDirty();
                      }}
                    />
                    <InputNumber
                      addonBefore="顺序"
                      min={0}
                      precision={0}
                      value={value.displayOrder}
                      onChange={displayOrder => {
                        updateDimensionValue(dimensionIndex, valueIndex, {displayOrder: displayOrder ?? 0});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-dimension-value-order-${dimensionIndex}-${valueIndex}`)}
                    />
                    <Select
                      value={value.status}
                      options={catalogEnumOptions(manifest, 'skuStatus')}
                      onChange={status => {
                        updateDimensionValue(dimensionIndex, valueIndex, {status});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-dimension-value-status-${dimensionIndex}-${valueIndex}`)}
                    />
                    <Button
                      danger
                      type="link"
                      onClick={() => {
                        updateDimension(dimensionIndex, {
                          values: dimension.values.filter((_, index) => index !== valueIndex),
                        });
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-dimension-value-remove-${dimensionIndex}-${valueIndex}`)}
                    >
                      移除
                    </Button>
                  </Space>
                ))}
              </Space>
            </Card>
          ))}
        </Space>
      </Card>
      <Card size="small" title={fieldLabel('skuMatrix')}>
        {skus.length === 0 && <EmptySection text="未维护 SKU；按 SKU 定价时启用 SKU 必须有标准价" />}
        <Space direction="vertical" size={10} style={{display: 'flex'}}>
          {skus.map((sku, skuIndex) => {
            const issueCodes = catalogSkuIssueCodes(
              sku,
              priceGranularity,
              (combinationCounts.get(skuCombinationKeyForFeedback(sku)) ?? 0) > 1,
              (skuCodeCounts.get(sku.skuCode.trim()) ?? 0) > 1,
            );
            const issues = issueCodes.map(issue => skuIssueLabels[issue]);
            const issue = (code: SkuDraftIssueCode) => (issueCodes.includes(code) ? skuIssueLabels[code] : undefined);
            return (
              <Card
                key={sku.editorId}
                size="small"
                style={{borderColor: issues.length ? '#ff4d4f' : undefined}}
                title={
                  <Space>
                    <Typography.Text>SKU {skuIndex + 1}</Typography.Text>
                    <Typography.Text type={issues.length ? 'danger' : 'secondary'}>
                      {sku.skuCode || '未编码'}
                    </Typography.Text>
                    {issues.length > 0 && <Tag color="error">需处理 {issues.length} 项</Tag>}
                  </Space>
                }
                extra={
                  <Space>
                    <DisabledReasonButton
                      danger
                      disabled={!canWriteCatalog || !sku.voidAvailability?.canVoid || Boolean(voidingSkuRef)}
                      loading={voidingSkuRef === sku.productSkuRef}
                      reason={
                        !canWriteCatalog
                          ? '当前角色无权作废 SKU。'
                          : (catalogVoidBlockReason(sku.voidAvailability) ?? '当前 SKU 不可作废。')
                      }
                      onClick={() => onVoidSku?.(sku)}
                      {...testId(`catalog-item-sku-void-${skuIndex}`)}
                    >
                      作废 SKU
                    </DisabledReasonButton>
                    <Button
                      danger
                      type="link"
                      onClick={() => {
                        onSkusChange(skus.filter((_, index) => index !== skuIndex));
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-row-remove-${skuIndex}`)}
                    >
                      移除
                    </Button>
                  </Space>
                }
              >
                {issues.length > 0 && (
                  <Typography.Text type="danger" {...testId(`catalog-item-sku-issues-${skuIndex}`)}>
                    {issues.join('；')}
                  </Typography.Text>
                )}
                <Space wrap>
                  <SkuFieldFeedback message={issue('MISSING_CODE') || issue('DUPLICATE_CODE')}>
                    <Input
                      addonBefore="SKU编码"
                      value={sku.skuCode}
                      status={issue('MISSING_CODE') || issue('DUPLICATE_CODE') ? 'error' : undefined}
                      disabled={Boolean(sku.productSkuRef)}
                      onChange={event => {
                        updateSku(skuIndex, {skuCode: event.target.value});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-code-${skuIndex}`)}
                    />
                  </SkuFieldFeedback>
                  <SkuFieldFeedback message={issue('MISSING_NAME')}>
                    <Input
                      addonBefore="SKU名称"
                      value={sku.skuName}
                      status={issue('MISSING_NAME') ? 'error' : undefined}
                      onChange={event => {
                        updateSku(skuIndex, {skuName: event.target.value});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-name-${skuIndex}`)}
                    />
                  </SkuFieldFeedback>
                  <Input
                    addonBefore="条码"
                    value={sku.skuBarcode}
                    onChange={event => {
                      updateSku(skuIndex, {skuBarcode: event.target.value});
                      onDirty();
                    }}
                    {...testId(`catalog-item-sku-barcode-${skuIndex}`)}
                  />
                  <SkuFieldFeedback message={issue('MISSING_SKU_PRICE')}>
                    <InputNumber
                      addonBefore="标准价（分）"
                      min={0}
                      precision={0}
                      status={issue('MISSING_SKU_PRICE') ? 'error' : undefined}
                      value={sku.standardSalePrice}
                      onChange={standardSalePrice => {
                        updateSku(skuIndex, {standardSalePrice: standardSalePrice ?? null});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-price-${skuIndex}`)}
                    />
                  </SkuFieldFeedback>
                  <Select
                    value={sku.status}
                    options={catalogEnumOptions(manifest, 'skuStatus').filter(option => option.value !== 'VOIDED')}
                    onChange={status => {
                      updateSku(skuIndex, {status});
                      onDirty();
                    }}
                    {...testId(`catalog-item-sku-status-${skuIndex}`)}
                  />
                  <Space>
                    <Typography.Text>默认</Typography.Text>
                    <Switch
                      checked={sku.isDefault}
                      onChange={isDefault => {
                        updateSku(skuIndex, {isDefault});
                        onDirty();
                      }}
                      {...testId(`catalog-item-sku-default-${skuIndex}`)}
                    />
                  </Space>
                </Space>
                <Divider style={{margin: '8px 0'}} />
                <Space
                  direction="vertical"
                  size={6}
                  style={{display: 'flex'}}
                  {...testId(`catalog-item-sku-media-${skuIndex}`)}
                >
                  <Typography.Text strong>SKU 图片</Typography.Text>
                  <Typography.Text type="secondary">
                    {mediaLimits
                      ? `每个 SKU ${mediaLimits.maxImageCount} 张以内 · 单张 ` +
                        `${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB`
                      : '媒体规则加载中'}
                  </Typography.Text>
                  <Space wrap>
                    {sku.mediaRefs.map((assetRef, mediaIndex) => (
                      <Space direction="vertical" size={2} key={assetRef}>
                        <CatalogAssetPreview
                          assetRef={assetRef}
                          alt={`${sku.skuName || sku.skuCode || `SKU ${skuIndex + 1}`}图片 ${mediaIndex + 1}`}
                          width={96}
                          height={72}
                          testId={`catalog-item-sku-media-preview-${skuIndex}-${mediaIndex}`}
                        />
                        <Space>
                          <Upload
                            accept="image/*"
                            showUploadList={false}
                            beforeUpload={file => {
                              void onStageSkuMedia(file as File, skuIndex, assetRef);
                              return Upload.LIST_IGNORE;
                            }}
                          >
                            <Button
                              size="small"
                              {...testId(`catalog-item-sku-media-replace-${skuIndex}-${mediaIndex}`)}
                            >
                              替换
                            </Button>
                          </Upload>
                          <Button
                            size="small"
                            danger
                            onClick={() => void onRemoveSkuMedia(skuIndex, assetRef)}
                            {...testId(`catalog-item-sku-media-remove-${skuIndex}-${mediaIndex}`)}
                          >
                            移除
                          </Button>
                        </Space>
                      </Space>
                    ))}
                  </Space>
                  <Space direction="vertical" size={6} style={{display: 'flex'}}>
                    {skuStagedMedia
                      .filter(asset => asset.skuIndex === skuIndex && asset.status !== 'READY')
                      .map(asset => (
                        <Space
                          key={asset.id}
                          align="start"
                          style={{border: '1px solid #f0f0f0', padding: 8, borderRadius: 6}}
                          {...testId(`catalog-item-sku-media-draft-${skuIndex}-${asset.id}`)}
                        >
                          <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                            <Typography.Text type="secondary">
                              {asset.status === 'UPLOADING' ? '上传中/处理中' : '上传失败'}
                            </Typography.Text>
                          </span>
                          <Space direction="vertical" size={2}>
                            <Typography.Text ellipsis={{tooltip: asset.fileName}}>{asset.fileName}</Typography.Text>
                            <Typography.Text
                              type={asset.status === 'FAILED' ? 'danger' : 'warning'}
                              {...testId(`catalog-item-sku-media-status-${skuIndex}-${asset.id}`)}
                            >
                              {asset.status === 'FAILED' ? (asset.error ?? '上传失败，请重试。') : '上传中/处理中'}
                            </Typography.Text>
                            <Space>
                              {asset.status === 'FAILED' && asset.file && (
                                <Button
                                  size="small"
                                  onClick={() =>
                                    void onStageSkuMedia(
                                      asset.file as File,
                                      skuIndex,
                                      asset.previous?.assetRef,
                                      asset.id,
                                    )
                                  }
                                  {...testId(`catalog-item-sku-media-retry-${skuIndex}-${asset.id}`)}
                                >
                                  重试
                                </Button>
                              )}
                              <Button
                                size="small"
                                danger
                                disabled={asset.status === 'UPLOADING'}
                                onClick={() => onRemoveSkuStagedMedia(asset.id)}
                                {...testId(`catalog-item-sku-media-draft-remove-${skuIndex}-${asset.id}`)}
                              >
                                移除
                              </Button>
                            </Space>
                          </Space>
                        </Space>
                      ))}
                  </Space>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={file => {
                      void onStageSkuMedia(file as File, skuIndex);
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button size="small" {...testId(`catalog-item-sku-media-upload-${skuIndex}`)}>
                      上传 SKU 图片
                    </Button>
                  </Upload>
                </Space>
                <Divider style={{margin: '8px 0'}} />
                <Space
                  direction="vertical"
                  size={4}
                  style={{display: 'flex'}}
                  {...testId(`catalog-item-sku-attribute-combination-${skuIndex}`)}
                >
                  <Typography.Text strong>属性组合（由维度生成）</Typography.Text>
                  {sku.attributeValueRefs.length ? (
                    <Space size={4} wrap>
                      {sku.attributeValueRefs.map((value, valueIndex) => (
                        <Space key={`${value.attributeValueRef}-${valueIndex}`} size={2}>
                          <NameCodeText
                            name={value.attributeName || undefined}
                            code={value.attributeCode || undefined}
                          />
                          <span>=</span>
                          <NameCodeText name={value.valueLabel || undefined} code={value.valueCode || undefined} />
                        </Space>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">尚未形成有效属性组合</Typography.Text>
                  )}
                  {issue('DUPLICATE_COMBINATION') && (
                    <Typography.Text type="danger" style={{fontSize: 12}}>
                      {issue('DUPLICATE_COMBINATION')}
                    </Typography.Text>
                  )}
                </Space>
              </Card>
            );
          })}
        </Space>
      </Card>
    </Space>
  );
}

function SkuMatrixReadOnly({
  manifest,
  dimensions,
  skus,
  summary,
  priceGranularity,
  standardSalePrice,
  missingPriceCount,
  canWriteCatalog,
  onVoidSku,
  voidingSkuRef,
}: {
  manifest?: CatalogManifest;
  dimensions: SkuDimensionDraft[];
  skus: CatalogSkuRow[];
  summary: CatalogDetail['item']['skuSummary'];
  priceGranularity: string;
  standardSalePrice?: number | null;
  missingPriceCount: number;
  canWriteCatalog: boolean;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
}) {
  const fieldLabel = (fieldKey: string) => catalogFieldLabel(manifest, fieldKey);
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-sku-matrix-readonly')}>
      <Descriptions
        {...adminWideDetailDescriptionsProps}
        items={[
          {
            key: 'sku',
            label: 'SKU 数量',
            children: `${summary.enabledCount}/${summary.nonArchivedCount}/${summary.totalCount}（启用/未归档/总数）`,
          },
          {
            key: 'granularity',
            label: '价格粒度',
            children: catalogEnumLabel(manifest, 'priceGranularity', priceGranularity),
          },
          {key: 'standard', label: '商品标准价', children: money(standardSalePrice ?? null)},
          {key: 'missing', label: '缺价数', children: missingPriceCount},
        ]}
      />
      <Card size="small" title={fieldLabel('skuVariantAttribute')}>
        {dimensions.length ? (
          dimensions.map(dimension => (
            <Typography.Text key={dimension.attributeCode} style={{display: 'block'}}>
              {dimension.attributeName || dimension.attributeCode}（{dimension.attributeCode}）：
              {dimension.values
                .map(value => `${value.valueLabel || value.valueCode}${value.status === 'ARCHIVED' ? ' · 归档' : ''}`)
                .join('、') || '—'}
            </Typography.Text>
          ))
        ) : (
          <EmptySection text="未维护规格维度" />
        )}
      </Card>
      <Card size="small" title={fieldLabel('skuMatrix')}>
        {skus.length ? (
          <Space direction="vertical" size={8} style={{display: 'flex'}}>
            {skus.map((sku, skuIndex) => {
              const issueCodes = catalogSkuIssueCodes(sku, priceGranularity, false, false);
              const issues = issueCodes.map(issue => skuIssueLabels[issue]);
              const variantValues = sku.attributeValueRefs.length ? (
                <Space wrap size={4}>
                  {sku.attributeValueRefs.map((value, valueIndex) => (
                    <Space key={`${value.attributeValueRef}-${valueIndex}`} size={2}>
                      <NameCodeText name={value.attributeName || undefined} code={value.attributeCode || undefined} />
                      <span>=</span>
                      <NameCodeText name={value.valueLabel || undefined} code={value.valueCode || undefined} />
                    </Space>
                  ))}
                </Space>
              ) : (
                '—'
              );
              return (
                <Card
                  key={sku.skuCode || `sku-${skuIndex}`}
                  size="small"
                  title={
                    <Space>
                      <NameCodeText name={sku.skuName} code={sku.skuCode} />
                      {issues.length > 0 && (
                        <Tag color="error" {...testId(`catalog-item-sku-readonly-issues-${skuIndex}`)}>
                          需处理 {issues.length} 项
                        </Tag>
                      )}
                    </Space>
                  }
                  extra={
                    <DisabledReasonButton
                      danger
                      disabled={!canWriteCatalog || !sku.voidAvailability?.canVoid || Boolean(voidingSkuRef)}
                      loading={voidingSkuRef === sku.productSkuRef}
                      reason={
                        !canWriteCatalog
                          ? '当前角色无权作废 SKU。'
                          : (catalogVoidBlockReason(sku.voidAvailability) ?? '当前 SKU 不可作废。')
                      }
                      onClick={() => onVoidSku?.(sku)}
                      {...testId(`catalog-item-sku-void-${skuIndex}`)}
                    >
                      作废 SKU
                    </DisabledReasonButton>
                  }
                >
                  {' '}
                  <Descriptions
                    size="small"
                    column={2}
                    items={[
                      {key: 'refs', label: catalogFieldLabel(manifest, 'skuVariantValues'), children: variantValues},
                      {key: 'barcode', label: '条码', children: sku.skuBarcode || '—'},
                      {key: 'price', label: '标准价', children: money(sku.standardSalePrice)},
                      {
                        key: 'status',
                        label: '状态',
                        children:
                          catalogEnumLabel(manifest, 'skuStatus', sku.status) + (sku.isDefault ? ' · 默认' : ''),
                      },
                      {
                        key: 'images',
                        label: '图片',
                        children: sku.mediaRefs.length ? (
                          <Space wrap>
                            {sku.mediaRefs.map((assetRef, mediaIndex) => (
                              <CatalogAssetPreview
                                key={assetRef}
                                assetRef={assetRef}
                                alt={`${sku.skuName || sku.skuCode || `SKU ${skuIndex + 1}`}图片 ${mediaIndex + 1}`}
                                width={96}
                                height={72}
                                testId={`catalog-item-sku-media-readonly-${skuIndex}-${mediaIndex}`}
                              />
                            ))}
                          </Space>
                        ) : (
                          '未配置'
                        ),
                      },
                      {key: 'version', label: '版本', children: sku.version},
                    ]}
                  />
                  {issues.length > 0 && (
                    <Typography.Text type="danger" {...testId(`catalog-item-sku-readonly-issue-text-${skuIndex}`)}>
                      {issues.join('；')}
                    </Typography.Text>
                  )}
                </Card>
              );
            })}
          </Space>
        ) : (
          <EmptySection text="未维护 SKU 明细" />
        )}
      </Card>
    </Space>
  );
}

function OrderOptionsEditor({
  values,
  createDraftRowId,
  onChange,
  onDirty,
}: {
  values: CatalogOrderOptionGroupDraft[];
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogOrderOptionGroupDraft[]) => void;
  onDirty: () => void;
}) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const updateGroup = (index: number, patch: Partial<CatalogOrderOptionGroupDraft>) =>
    onChange(values.map((group, groupIndex) => (groupIndex === index ? {...group, ...patch} : group)));
  const updateValue = (groupIndex: number, valueIndex: number, patch: Partial<CatalogOrderOptionValueDraft>) =>
    onChange(
      values.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              values: group.values.map((value, entryIndex) =>
                entryIndex === valueIndex ? {...value, ...patch} : value,
              ),
            }
          : group,
      ),
    );
  useEffect(() => {
    if (selectedGroupIndex >= values.length) setSelectedGroupIndex(Math.max(0, values.length - 1));
  }, [selectedGroupIndex, values.length]);
  const selectedGroup = values[selectedGroupIndex];
  const selectedErrors = selectedGroup
    ? [
        !selectedGroup.groupCode.trim() ? '组编码不能为空' : undefined,
        !selectedGroup.groupName.trim() ? '组名不能为空' : undefined,
        selectedGroup.values.length === 0 ? '至少添加一个选项值' : undefined,
        ...selectedGroup.values.flatMap((value, index) => [
          !value.code.trim() ? `第 ${index + 1} 个选项值缺少编码` : undefined,
          !value.name.trim() ? `第 ${index + 1} 个选项值缺少名称` : undefined,
        ]),
      ].filter((entry): entry is string => Boolean(entry))
    : [];
  const addGroup = () => {
    const next = [...values, {groupCode: '', groupName: '', selectionMode: 'SINGLE', required: false, values: []}];
    onChange(next);
    setSelectedGroupIndex(next.length - 1);
    onDirty();
  };
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-order-options-editor')}>
      <Alert type="info" showIcon title="设置点单分组和选项值；右侧可预览当前效果并查看需要修复的内容。" />
      <Button onClick={addGroup} {...testId('catalog-item-order-option-group-add')}>
        新增选项组
      </Button>
      {values.length === 0 ? (
        <EmptySection text="未维护点单选项组" />
      ) : (
        <Row gutter={12} align="top">
          <Col span={6}>
            <Card size="small" title="点单分组" {...testId('catalog-item-order-options-groups')}>
              <List
                size="small"
                dataSource={values}
                renderItem={(group, index) => (
                  <List.Item
                    key={`${group.groupCode}-${index}`}
                    onClick={() => setSelectedGroupIndex(index)}
                    style={{
                      cursor: 'pointer',
                      background: index === selectedGroupIndex ? '#e6f4ff' : undefined,
                      paddingInline: 8,
                    }}
                    {...testId(`catalog-item-order-options-group-${index}`)}
                  >
                    <Space>
                      <Typography.Text strong={index === selectedGroupIndex}>
                        {group.groupName || '未命名组'}
                      </Typography.Text>
                      <Typography.Text type="secondary">{group.values.length}项</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card
              size="small"
              title={selectedGroup ? `选项组详情 · ${selectedGroup.groupName || '未命名组'}` : '选项组详情'}
              {...testId('catalog-item-order-options-details')}
            >
              {selectedGroup && (
                <Space direction="vertical" size={8} style={{display: 'flex'}}>
                  <Space wrap>
                    <Input
                      addonBefore="组编码"
                      value={selectedGroup.groupCode}
                      onChange={event => {
                        updateGroup(selectedGroupIndex, {groupCode: event.target.value});
                        onDirty();
                      }}
                      {...testId(`catalog-item-order-option-group-code-${selectedGroupIndex}`)}
                    />
                    <Input
                      addonBefore="组名"
                      value={selectedGroup.groupName}
                      onChange={event => {
                        updateGroup(selectedGroupIndex, {groupName: event.target.value});
                        onDirty();
                      }}
                      {...testId(`catalog-item-order-option-group-name-${selectedGroupIndex}`)}
                    />
                    <Select
                      value={selectedGroup.selectionMode}
                      options={[
                        {label: '单选', value: 'SINGLE'},
                        {label: '多选', value: 'MULTIPLE'},
                        {label: '固定包含', value: 'FIXED'},
                      ]}
                      onChange={selectionMode => {
                        updateGroup(selectedGroupIndex, {selectionMode});
                        onDirty();
                      }}
                      {...testId(`catalog-item-order-option-group-mode-${selectedGroupIndex}`)}
                    />
                    <Space>
                      <Typography.Text>必选</Typography.Text>
                      <Switch
                        checked={selectedGroup.required}
                        onChange={required => {
                          updateGroup(selectedGroupIndex, {required});
                          onDirty();
                        }}
                        {...testId(`catalog-item-order-option-group-required-${selectedGroupIndex}`)}
                      />
                    </Space>
                  </Space>
                  <Divider style={{margin: '4px 0'}} />
                  <Space style={{justifyContent: 'space-between', width: '100%'}}>
                    <Typography.Text strong>选项值</Typography.Text>
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          updateGroup(selectedGroupIndex, {
                            values: [
                              ...selectedGroup.values,
                              {
                                editorId: createDraftRowId('order-option-value'),
                                code: '',
                                attributeValueRef: draftUuid(),
                                name: '',
                                default: false,
                                extraPrice: null,
                                productionEffects: [],
                              },
                            ],
                          });
                          onDirty();
                        }}
                        {...testId(`catalog-item-order-option-value-add-${selectedGroupIndex}`)}
                      >
                        新增选项值
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          onChange(values.filter((_, index) => index !== selectedGroupIndex));
                          onDirty();
                        }}
                        {...testId(`catalog-item-order-option-group-remove-${selectedGroupIndex}`)}
                      >
                        移除组
                      </Button>
                    </Space>
                  </Space>
                  {selectedGroup.values.map((value, valueIndex) => (
                    <Card key={value.editorId} size="small" title={`选项值 ${valueIndex + 1}`}>
                      <Space wrap>
                        <Input
                          addonBefore="值编码"
                          value={value.code}
                          onChange={event => {
                            updateValue(selectedGroupIndex, valueIndex, {code: event.target.value});
                            onDirty();
                          }}
                          {...testId(`catalog-item-order-option-value-code-${selectedGroupIndex}-${valueIndex}`)}
                        />
                        <Input
                          addonBefore="值名称"
                          value={value.name}
                          onChange={event => {
                            updateValue(selectedGroupIndex, valueIndex, {name: event.target.value});
                            onDirty();
                          }}
                          {...testId(`catalog-item-order-option-value-name-${selectedGroupIndex}-${valueIndex}`)}
                        />
                        <InputNumber
                          addonBefore="加价（分）"
                          value={value.extraPrice}
                          min={0}
                          precision={0}
                          onChange={extraPrice => {
                            updateValue(selectedGroupIndex, valueIndex, {extraPrice: extraPrice ?? null});
                            onDirty();
                          }}
                          {...testId(`catalog-item-order-option-value-price-${selectedGroupIndex}-${valueIndex}`)}
                        />
                        <Input
                          addonBefore="制作影响"
                          value={value.productionEffects.join(',')}
                          onChange={event => {
                            updateValue(selectedGroupIndex, valueIndex, {
                              productionEffects: splitComma(event.target.value),
                            });
                            onDirty();
                          }}
                          {...testId(`catalog-item-order-option-value-effects-${selectedGroupIndex}-${valueIndex}`)}
                        />
                        <Space>
                          <Typography.Text>默认</Typography.Text>
                          <Switch
                            checked={value.default}
                            onChange={defaultValue => {
                              updateValue(selectedGroupIndex, valueIndex, {default: defaultValue});
                              onDirty();
                            }}
                            {...testId(`catalog-item-order-option-value-default-${selectedGroupIndex}-${valueIndex}`)}
                          />
                        </Space>
                        <Button
                          danger
                          type="link"
                          onClick={() => {
                            updateGroup(selectedGroupIndex, {
                              values: selectedGroup.values.filter((_, index) => index !== valueIndex),
                            });
                            onDirty();
                          }}
                          {...testId(`catalog-item-order-option-value-remove-${selectedGroupIndex}-${valueIndex}`)}
                        >
                          移除
                        </Button>
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="点单预览 / 校验" {...testId('catalog-item-order-options-preview')}>
              {selectedGroup ? (
                <Space direction="vertical" size={8} style={{display: 'flex'}}>
                  <Typography.Text strong>
                    {selectedGroup.groupName || '未命名组'} {selectedGroup.required ? '（必选）' : '（可选）'}
                  </Typography.Text>
                  <Space wrap>
                    {selectedGroup.values.map((value, index) => (
                      <Tag color={value.default ? 'blue' : undefined} key={`${value.code}-${index}`}>
                        {value.name || value.code || '未命名值'}
                        {value.extraPrice === null ? '' : ` +¥${(value.extraPrice / 100).toFixed(2)}`}
                      </Tag>
                    ))}
                  </Space>
                  {selectedErrors.length ? (
                    <Alert
                      type="warning"
                      showIcon
                      title="需要修复"
                      description={
                        <ul style={{paddingLeft: 16, margin: 0}}>
                          {selectedErrors.map(error => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      }
                      {...testId('catalog-item-order-options-validation')}
                    />
                  ) : (
                    <Alert
                      type="success"
                      showIcon
                      title="当前分组可提交"
                      {...testId('catalog-item-order-options-validation')}
                    />
                  )}
                  <Typography.Text type="secondary">
                    实时预览仅反映当前编辑内容；保存时会再次检查全部分组。
                  </Typography.Text>
                </Space>
              ) : (
                <Empty description="请选择一个点单分组" />
              )}
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
}

function OrderOptionsReadOnly({values}: {values: CatalogOrderOptionGroup[]}) {
  if (!values.length) return <EmptySection text="未维护点单选项组" />;
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-order-options-readonly')}>
      {values.map(group => {
        const preview = group.values.length ? (
          <Space size={4} wrap>
            {group.values.map((value, valueIndex) => (
              <Space key={`${value.code}-${valueIndex}`} size={2}>
                <NameCodeText name={value.name || undefined} code={value.code || undefined} />
                {value.default && <Typography.Text type="secondary">（默认）</Typography.Text>}
              </Space>
            ))}
          </Space>
        ) : (
          '—'
        );
        const valueRows = (
          <Space direction="vertical" size={2}>
            {group.values.map((value, valueIndex) => (
              <Typography.Text key={`${value.code}-${valueIndex}`}>
                {value.code || '—'} · {value.name || '—'} · {money(value.extraPrice)} · 制作影响：
                {value.productionEffects.join('、') || '—'}
              </Typography.Text>
            ))}
          </Space>
        );
        return (
          <Card
            key={group.groupCode || group.groupName}
            size="small"
            title={<NameCodeText name={group.groupName || '未命名组'} code={group.groupCode || undefined} />}
          >
            <Descriptions
              size="small"
              column={2}
              items={[
                {
                  key: 'mode',
                  label: '选择规则',
                  children: `${group.selectionMode || '—'}${group.required ? ' · 必选' : ' · 可选'}`,
                },
                {key: 'preview', label: '点单预览', children: preview},
              ]}
            />
            {group.values.length > 0 && (
              <Descriptions size="small" column={1} items={[{key: 'values', label: '选项值', children: valueRows}]} />
            )}
          </Card>
        );
      })}
    </Space>
  );
}

function ProductionProfileEditor({
  layer,
  profiles,
  onLayerChange,
  onChange,
  onDirty,
}: {
  layer: ProfileLayer;
  profiles: ProductionProfileDraft;
  onLayerChange: (next: ProfileLayer) => void;
  onChange: (next: ProductionProfileDraft) => void;
  onDirty: () => void;
}) {
  const profile = profiles[layer];
  const setProfileValue = (key: string, value: JsonValue | undefined) => {
    const nextProfile = {...profile};
    if (value === undefined || value === '') delete nextProfile[key];
    else nextProfile[key] = value;
    onChange({...profiles, [layer]: nextProfile});
    onDirty();
  };
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId('catalog-item-production-profile-editor')}
    >
      <Space wrap>
        <Typography.Text strong>生产提示节点</Typography.Text>
        <Select
          value={layer}
          options={Object.entries(profileLayerLabels).map(([value, label]) => ({value, label}))}
          onChange={onLayerChange}
          {...testId('catalog-production-profile-node')}
        />
      </Space>
      <Alert type="info" showIcon title="商品、SKU 和选项值可分别设置制作信息；切换对象不会自动沿用其他对象的设置。" />
      {profileFields.map(field =>
        field.kind === 'tags' ? (
          <Input
            key={field.key}
            addonBefore={field.label}
            value={profileTags(profile, field.key).join(',')}
            placeholder="多个值用逗号分隔"
            onChange={event => setProfileValue(field.key, splitComma(event.target.value))}
            {...testId(`catalog-production-profile-${field.key}`)}
          />
        ) : field.kind === 'number' ? (
          <InputNumber
            key={field.key}
            addonBefore={field.label}
            min={0}
            precision={0}
            value={profileNumber(profile, field.key)}
            onChange={value => setProfileValue(field.key, value ?? undefined)}
            {...testId(`catalog-production-profile-${field.key}`)}
          />
        ) : (
          <Input
            key={field.key}
            addonBefore={field.label}
            value={profileString(profile, field.key)}
            onChange={event => setProfileValue(field.key, event.target.value)}
            {...testId(`catalog-production-profile-${field.key}`)}
          />
        ),
      )}
    </Space>
  );
}

function ProductionProfilesReadOnly({profiles}: {profiles: ProductionProfileDraft}) {
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId('catalog-item-production-profile-readonly')}
    >
      {(Object.keys(profileLayerLabels) as ProfileLayer[]).map(layer => (
        <Card key={layer} size="small" title={profileLayerLabels[layer]}>
          {Object.keys(profiles[layer]).length ? (
            <Descriptions
              size="small"
              column={2}
              items={Object.entries(profiles[layer]).map(([key, value]) => ({
                key,
                label: profileFields.find(field => field.key === key)?.label ?? '其他制作信息',
                children: profileDisplayValue(value),
              }))}
            />
          ) : (
            <EmptySection text="未维护该节点的生产提示" />
          )}
        </Card>
      ))}
    </Space>
  );
}

function InventoryBomEditor({
  manifest,
  shapeKey,
  values,
  orderOptions,
  scopeRef,
  brandRef,
  version,
  onChange,
  onDirty,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  values: CatalogInventoryBomEntry[];
  orderOptions: CatalogOrderOptionGroup[];
  scopeRef?: string;
  brandRef?: string;
  version: number;
  onChange: (next: CatalogInventoryBomEntry[]) => void;
  onDirty: () => void;
}) {
  const pickerContext = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
      readField: () => undefined,
      readSection: () => orderOptions,
      sectionRevision: () => `${version}:${JSON.stringify(orderOptions)}`,
    }),
    [brandRef, orderOptions, scopeRef, version],
  );
  const hasOrderOptionValues = orderOptions.some(group => group.values.length > 0);
  const update = (index: number, patch: Partial<CatalogInventoryBomEntry>) =>
    onChange(values.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  const updateConfiguration = (
    index: number,
    patch: Partial<NonNullable<CatalogInventoryBomEntry['configuration']>>,
  ) => {
    const current = values[index]?.configuration ?? {
      allowNegative: false,
      lowStockThreshold: null,
      countingUnit: '',
      conversionFactor: '1',
    };
    update(index, {configuration: {...current, ...patch}});
  };
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-inventory-bom-editor')}>
      <Alert type="info" showIcon title="在此配置库存方式和配方；实际库存请到门店库存管理查看。" />
      <Button
        onClick={() => {
          onChange([
            ...values,
            {
              nodeType: 'ITEM',
              mode: 'INDEPENDENT_STOCK',
              targetRef: draftUuid(),
              quantity: '0',
              unit: '',
              itemCode: '',
              skuCode: null,
              consumptionUnit: '',
              configuration: {allowNegative: false, lowStockThreshold: null, countingUnit: '', conversionFactor: '1'},
            },
          ]);
          onDirty();
        }}
        {...testId('catalog-item-inventory-bom-add')}
      >
        新增独立库存对象
      </Button>
      <Button
        onClick={() => {
          onChange([
            ...values,
            {nodeType: 'ITEM_BOM', mode: 'BOM', targetRef: draftUuid(), quantity: '1', unit: '', optionValueCode: null},
          ]);
          onDirty();
        }}
        {...testId('catalog-item-inventory-bom-add-line')}
      >
        新增 BOM 组件
      </Button>
      {values.length === 0 && <EmptySection text="未维护库存对象或 BOM" />}
      {values.map((entry, index) => (
        <Card
          key={`${entry.targetRef}-${index}`}
          size="small"
          title={`节点 ${index + 1}`}
          extra={
            <Button
              danger
              type="link"
              onClick={() => {
                onChange(values.filter((_, entryIndex) => entryIndex !== index));
                onDirty();
              }}
              {...testId(`catalog-item-inventory-bom-remove-${index}`)}
            >
              移除
            </Button>
          }
        >
          <Space wrap>
            <Select
              value={entry.mode}
              options={catalogEnumOptions(manifest, 'inventoryMode')}
              onChange={mode => {
                update(index, {mode});
                onDirty();
              }}
              {...testId(`catalog-item-inventory-bom-mode-${index}`)}
            />
            {entry.mode === 'BOM' && (
              <>
                {catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, 'bomOptionValue') && (
                  <CatalogDescriptorPicker
                    manifest={manifest}
                    shapeKey={shapeKey}
                    fieldKey="bomOptionValue"
                    value={String(entry.optionValueRef ?? '')}
                    context={pickerContext}
                    disabled={!hasOrderOptionValues}
                    disabledMessage={!hasOrderOptionValues ? '当前商品没有可用的点单选项值。' : undefined}
                    testIdValue={`catalog-item-inventory-bom-option-value-${index}`}
                    onChange={(next, rawRow) => {
                      const row = descriptorRow(rawRow);
                      const selected = descriptorString(next);
                      update(index, {
                        optionValueRef: selected ? draftUuid(selected) : null,
                        optionValueCode: typeof row?.code === 'string' ? row.code : null,
                        nodeType: selected ? 'OPTION_VALUE_BOM' : 'ITEM_BOM',
                      });
                      onDirty();
                    }}
                  />
                )}
                <CatalogDescriptorPicker
                  manifest={manifest}
                  shapeKey={shapeKey}
                  fieldKey="bomTarget"
                  value={String(entry.targetRef ?? '')}
                  context={pickerContext}
                  testIdValue={`catalog-item-inventory-bom-target-${index}`}
                  onChange={(next, rawRow) => {
                    const row = descriptorRow(rawRow);
                    update(index, {
                      targetRef: draftUuid(descriptorString(next)),
                      itemCode: typeof row?.productCode === 'string' ? row.productCode : '',
                      itemRef: typeof row?.itemRef === 'string' ? draftUuid(row.itemRef) : undefined,
                      productSkuRef: typeof row?.productSkuRef === 'string' ? draftUuid(row.productSkuRef) : null,
                      skuCode: typeof row?.skuCode === 'string' ? row.skuCode : null,
                    });
                    onDirty();
                  }}
                />
              </>
            )}
            {entry.mode === 'INDEPENDENT_STOCK' && (
              <>
                <Input
                  addonBefore="消耗单位（新建时必填）"
                  value={entry.consumptionUnit ?? ''}
                  onChange={event => {
                    update(index, {consumptionUnit: event.target.value});
                    onDirty();
                  }}
                  {...testId(`catalog-item-inventory-bom-consumption-unit-${index}`)}
                />
                <Input
                  addonBefore="低库存阈值"
                  value={entry.configuration?.lowStockThreshold ?? ''}
                  onChange={event => {
                    updateConfiguration(index, {lowStockThreshold: event.target.value || null});
                    onDirty();
                  }}
                  {...testId(`catalog-item-inventory-bom-low-threshold-${index}`)}
                />
                <Space>
                  <Typography.Text>允许负库存</Typography.Text>
                  <Switch
                    checked={entry.configuration?.allowNegative ?? false}
                    onChange={allowNegative => {
                      updateConfiguration(index, {allowNegative});
                      onDirty();
                    }}
                    {...testId(`catalog-item-inventory-bom-allow-negative-${index}`)}
                  />
                </Space>
                <Input
                  addonBefore="盘点单位"
                  value={entry.configuration?.countingUnit ?? ''}
                  onChange={event => {
                    updateConfiguration(index, {countingUnit: event.target.value});
                    onDirty();
                  }}
                  {...testId(`catalog-item-inventory-bom-counting-unit-${index}`)}
                />
                <Input
                  addonBefore="盘点换算"
                  value={entry.configuration?.conversionFactor ?? ''}
                  onChange={event => {
                    updateConfiguration(index, {conversionFactor: event.target.value});
                    onDirty();
                  }}
                  {...testId(`catalog-item-inventory-bom-conversion-factor-${index}`)}
                />
              </>
            )}
            <Input
              addonBefore="每份消耗"
              value={entry.quantity}
              onChange={event => {
                update(index, {quantity: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-inventory-bom-quantity-${index}`)}
            />
            <Input
              addonBefore="单位"
              value={entry.unit}
              onChange={event => {
                update(index, {unit: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-inventory-bom-unit-${index}`)}
            />
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function InventoryBomReadOnly({manifest, values}: {manifest?: CatalogManifest; values: CatalogInventoryBomEntry[]}) {
  const fieldLabel = (fieldKey: string) => catalogFieldLabel(manifest, fieldKey);
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-inventory-bom-readonly')}>
      {!values.length ? (
        <EmptySection text="未维护库存对象或 BOM" />
      ) : (
        values.map((entry, index) => (
          <Card key={`${entry.targetRef}-${index}`} size="small" title="库存 / BOM 节点">
            <Descriptions
              size="small"
              column={2}
              items={[
                {key: 'mode', label: '允许模式', children: catalogEnumLabel(manifest, 'inventoryMode', entry.mode)},
                {
                  key: 'owner',
                  label: fieldLabel('bomOptionValue'),
                  children: entry.optionValueCode ? (
                    <Typography.Text code>{entry.optionValueCode}</Typography.Text>
                  ) : entry.skuCode ? (
                    <Typography.Text code>{entry.skuCode}</Typography.Text>
                  ) : entry.itemCode ? (
                    <Typography.Text code>{entry.itemCode}</Typography.Text>
                  ) : (
                    '商品/SKU'
                  ),
                },
                {
                  key: 'target',
                  label: fieldLabel('bomTarget'),
                  children: entry.itemCode ? (
                    <Typography.Text code>{entry.itemCode}</Typography.Text>
                  ) : entry.skuCode ? (
                    <Typography.Text code>{entry.skuCode}</Typography.Text>
                  ) : (
                    '未设置库存对象编码'
                  ),
                },
                {key: 'quantity', label: 'BOM 每份消耗', children: `${entry.quantity || '—'} ${entry.unit || ''}`},
                ...(entry.mode === 'INDEPENDENT_STOCK'
                  ? [
                      {key: 'consumptionUnit', label: '消耗单位', children: entry.consumptionUnit || '—'},
                      {
                        key: 'lowStockThreshold',
                        label: '低库存阈值',
                        children: entry.configuration?.lowStockThreshold || '—',
                      },
                      {
                        key: 'allowNegative',
                        label: '允许负库存',
                        children: entry.configuration?.allowNegative ? '是' : '否',
                      },
                      {key: 'countingUnit', label: '盘点单位', children: entry.configuration?.countingUnit || '—'},
                      {
                        key: 'conversionFactor',
                        label: '盘点换算',
                        children: entry.configuration?.conversionFactor || '—',
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        ))
      )}
    </Space>
  );
}

function CompositeCandidatePicker({
  manifest,
  value,
  currentItemCode,
  queryContext,
  brandRef,
  onSelect,
  testIdValue,
}: {
  manifest?: CatalogManifest;
  value: string;
  currentItemCode?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  onSelect: (item: {itemCode: string; itemRef: CatalogCompositeComponent['itemRef']}) => void;
  testIdValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryRef, setCategoryRef] = useState<string>();
  const [cursor, setCursor] = useState('');
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const navigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), viewKey: 'ALL'}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const itemRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItems(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(keyword.trim() ? {keyword: keyword.trim()} : {}),
            ...(categoryRef ? {categoryRef: wireUuid(categoryRef), includeSubCategories: true} : {}),
            ...(cursor ? {cursor} : {}),
            pageSize: 20,
          },
          headers,
        },
      ),
    [categoryRef, cursor, headers, keyword, queryContext.scopeRef],
  );
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !open});
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemRequest, {skip: !open});
  const navigation = decodeNavigation(navigationQuery.data);
  const page = decodeItems(itemsQuery.data);
  const treeData = useMemo(() => buildCategoryTree(navigation.tree), [navigation.tree]);
  useEffect(() => {
    if (!open) {
      setKeyword('');
      setCategoryRef(undefined);
      setCursor('');
    }
  }, [open]);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...testId(testIdValue)}>
        {value ? <Typography.Text code>{value}</Typography.Text> : '选择组件商品'}
      </Button>
      {value && <Typography.Text type="secondary">已选商品编码：{value}</Typography.Text>}
      <Drawer
        title="选择套餐组件商品"
        open={open}
        onClose={() => setOpen(false)}
        {...adminWideDrawerSurfaceProps}
        {...testId(`${testIdValue}-drawer`)}
      >
        <Alert
          type="info"
          showIcon
          title="请选择当前商品库中可引用的商品，不能手工填写商品名称或编码。"
          style={{marginBottom: 12}}
        />
        <Row gutter={12} align="top">
          <Col span={8}>
            <Card size="small" title="分类" {...testId(`${testIdValue}-categories`)}>
              {treeData.length ? (
                <Tree
                  treeData={treeData}
                  selectedKeys={categoryRef ? [categoryRef] : []}
                  onSelect={keys => {
                    setCategoryRef(String(keys[0] ?? ''));
                    setCursor('');
                  }}
                />
              ) : (
                <Empty description="暂无分类" />
              )}
            </Card>
          </Col>
          <Col span={16}>
            <Space direction="vertical" size={12} style={{display: 'flex'}}>
              <Input.Search
                value={keyword}
                placeholder="在选定分类中搜索商品名称或编码"
                allowClear
                onChange={event => {
                  setKeyword(event.target.value);
                  setCursor('');
                }}
                onSearch={() => setCursor('')}
                {...testId(`${testIdValue}-search`)}
              />
              {itemsQuery.isError && (
                <Alert
                  type="error"
                  showIcon
                  title="候选查询失败"
                  description="暂时无法加载可选商品，请重试。"
                  action={
                    <Button size="small" onClick={() => void itemsQuery.refetch()}>
                      重试
                    </Button>
                  }
                  {...testId(`${testIdValue}-error`)}
                />
              )}
              <List
                loading={itemsQuery.isLoading || itemsQuery.isFetching}
                dataSource={page.items.filter(item => item.code !== currentItemCode)}
                locale={{emptyText: '暂无可引用商品'}}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Button
                        key="select"
                        type="link"
                        onClick={() => {
                          onSelect({itemCode: item.code, itemRef: item.itemRef});
                          setOpen(false);
                        }}
                        {...testId(`${testIdValue}-select-${item.code}`)}
                      >
                        选择
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<NameCodeText name={item.name} code={item.code} />}
                      description={[
                        catalogEnumLabel(manifest, 'shapeKey', item.shapeKey),
                        catalogEnumLabel(manifest, 'catalogItemStatus', item.status),
                        catalogEnumLabel(manifest, 'catalogSource', item.source),
                      ].join(' · ')}
                    />
                  </List.Item>
                )}
              />
              {page.cursor && (
                <Button
                  onClick={() => setCursor(page.cursor)}
                  loading={itemsQuery.isFetching}
                  {...testId(`${testIdValue}-next`)}
                >
                  加载下一页
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Drawer>
    </>
  );
}

type CategoryTreeNode = {key: string; title: string; children?: CategoryTreeNode[]};
function buildCategoryTree(nodes: ReturnType<typeof decodeNavigation>['tree']): CategoryTreeNode[] {
  const byParent = new Map<string, typeof nodes>();
  nodes.forEach(node => {
    const parent = node.parentCategoryRef ?? '';
    byParent.set(parent, [...(byParent.get(parent) ?? []), node]);
  });
  const build = (parent: string): CategoryTreeNode[] =>
    (byParent.get(parent) ?? []).map(node => {
      const children = build(node.categoryRef);
      return {key: node.categoryRef, title: `${node.name}（${node.count}）`, ...(children.length ? {children} : {})};
    });
  return build('');
}

function CompositeSkuDescriptorPicker({
  manifest,
  shapeKey,
  value,
  itemCode,
  queryContext,
  brandRef,
  version,
  testIdValue,
  onChange,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  value: string;
  itemCode: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  version: number;
  testIdValue: string;
  onChange: (value: string, skuCode?: string) => void;
}) {
  const context = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
      readField: () => itemCode,
      readSection: () => [],
      sectionRevision: () => `${version}:${itemCode}`,
    }),
    [brandRef, itemCode, queryContext.scopeRef, version],
  );
  return (
    <CatalogDescriptorPicker
      manifest={manifest}
      shapeKey={shapeKey}
      fieldKey="compositeComponentSku"
      value={value}
      context={context}
      disabled={!itemCode}
      disabledMessage={!itemCode ? '请先选择组件商品，再选择其 SKU。' : undefined}
      testIdValue={testIdValue}
      onChange={(next, rawRow) => {
        const row = descriptorRow(rawRow);
        onChange(descriptorString(next), typeof row?.skuCode === 'string' ? row.skuCode : undefined);
      }}
    />
  );
}

function CompositeGroupsEditor({
  manifest,
  shapeKey,
  values,
  onChange,
  onDirty,
  queryContext,
  brandRef,
  currentItemCode,
  version,
}: {
  manifest?: CatalogManifest;
  shapeKey: string;
  values: CatalogCompositeGroup[];
  onChange: (next: CatalogCompositeGroup[]) => void;
  onDirty: () => void;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  version: number;
}) {
  const updateGroup = (index: number, patch: Partial<CatalogCompositeGroup>) =>
    onChange(values.map((group, groupIndex) => (groupIndex === index ? {...group, ...patch} : group)));
  const updateComponent = (groupIndex: number, componentIndex: number, patch: Partial<CatalogCompositeComponent>) =>
    onChange(
      values.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              components: group.components.map((component, entryIndex) =>
                entryIndex === componentIndex ? {...component, ...patch} : component,
              ),
            }
          : group,
      ),
    );
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-composite-groups-editor')}>
      <Alert type="info" showIcon title="在此设置套餐组件；库存和制作信息请在相应商品中维护。" />
      <Button
        onClick={() => {
          onChange([
            ...values,
            {
              groupCode: '',
              groupName: '',
              selectionRule: 'FIXED',
              minSelections: 0,
              maxSelections: 0,
              displayOrder: values.length,
              components: [],
            },
          ]);
          onDirty();
        }}
        {...testId('catalog-item-composite-group-add')}
      >
        新增套餐分组
      </Button>
      {values.length === 0 && <EmptySection text="未维护套餐分组" />}
      {values.map((group, groupIndex) => (
        <Card
          key={`${group.groupCode}-${groupIndex}`}
          size="small"
          title={`套餐分组 ${groupIndex + 1}`}
          extra={
            <Button
              danger
              type="link"
              onClick={() => {
                onChange(values.filter((_, index) => index !== groupIndex));
                onDirty();
              }}
              {...testId(`catalog-item-composite-group-remove-${groupIndex}`)}
            >
              移除组
            </Button>
          }
        >
          <Space direction="vertical" size={8} style={{display: 'flex'}}>
            <Space wrap>
              <Input
                addonBefore="组编码"
                value={group.groupCode}
                onChange={event => {
                  updateGroup(groupIndex, {groupCode: event.target.value});
                  onDirty();
                }}
                {...testId(`catalog-item-composite-group-code-${groupIndex}`)}
              />
              <Input
                addonBefore="组名"
                value={group.groupName}
                onChange={event => {
                  updateGroup(groupIndex, {groupName: event.target.value});
                  onDirty();
                }}
                {...testId(`catalog-item-composite-group-name-${groupIndex}`)}
              />
              <Select
                value={group.selectionRule}
                options={[
                  {value: 'FIXED', label: '固定包含'},
                  {value: 'SINGLE', label: '单选'},
                  {value: 'MULTIPLE', label: '多选'},
                ]}
                onChange={selectionRule => {
                  updateGroup(groupIndex, {selectionRule});
                  onDirty();
                }}
                {...testId(`catalog-item-composite-group-rule-${groupIndex}`)}
              />
            </Space>
            <Button
              size="small"
              onClick={() => {
                updateGroup(groupIndex, {
                  components: [
                    ...group.components,
                    {
                      itemCode: '',
                      itemRef: draftUuid(),
                      productSkuRef: null,
                      skuCode: null,
                      quantity: '1',
                      unit: '',
                      default: false,
                      extraPrice: null,
                      status: 'ENABLED',
                      displayOrder: group.components.length,
                    },
                  ],
                });
                onDirty();
              }}
              {...testId(`catalog-item-composite-component-add-${groupIndex}`)}
            >
              添加组件
            </Button>
            {group.components.map((component, componentIndex) => (
              <Space key={`${component.itemCode}-${componentIndex}`} wrap>
                <CompositeCandidatePicker
                  manifest={manifest}
                  value={component.itemCode}
                  currentItemCode={currentItemCode}
                  queryContext={queryContext}
                  brandRef={brandRef}
                  testIdValue={`catalog-item-composite-component-item-${groupIndex}-${componentIndex}`}
                  onSelect={item => {
                    updateComponent(groupIndex, componentIndex, {...item, productSkuRef: null, skuCode: null});
                    onDirty();
                  }}
                />
                <CompositeSkuDescriptorPicker
                  manifest={manifest}
                  shapeKey={shapeKey}
                  value={String(component.productSkuRef ?? '')}
                  itemCode={component.itemCode}
                  queryContext={queryContext}
                  brandRef={brandRef}
                  version={version}
                  testIdValue={`catalog-item-composite-component-sku-${groupIndex}-${componentIndex}`}
                  onChange={(next, skuCode) => {
                    updateComponent(groupIndex, componentIndex, {
                      productSkuRef: next ? draftUuid(next) : null,
                      skuCode: skuCode ?? null,
                    });
                    onDirty();
                  }}
                />
                <Input
                  addonBefore="数量"
                  value={component.quantity}
                  onChange={event => {
                    updateComponent(groupIndex, componentIndex, {quantity: event.target.value});
                    onDirty();
                  }}
                  {...testId(`catalog-item-composite-component-quantity-${groupIndex}-${componentIndex}`)}
                />
                <Input
                  addonBefore="单位"
                  value={component.unit}
                  onChange={event => {
                    updateComponent(groupIndex, componentIndex, {unit: event.target.value});
                    onDirty();
                  }}
                  {...testId(`catalog-item-composite-component-unit-${groupIndex}-${componentIndex}`)}
                />
                <InputNumber
                  addonBefore="加价（分）"
                  value={component.extraPrice}
                  min={0}
                  precision={0}
                  onChange={extraPrice => {
                    updateComponent(groupIndex, componentIndex, {extraPrice: extraPrice ?? null});
                    onDirty();
                  }}
                  {...testId(`catalog-item-composite-component-price-${groupIndex}-${componentIndex}`)}
                />
                <Select
                  value={component.status}
                  options={catalogEnumOptions(manifest, 'catalogItemStatus').filter(
                    option => option.value === 'ENABLED' || option.value === 'DISABLED',
                  )}
                  onChange={status => {
                    updateComponent(groupIndex, componentIndex, {status});
                    onDirty();
                  }}
                  {...testId(`catalog-item-composite-component-status-${groupIndex}-${componentIndex}`)}
                />
                <Space>
                  <Typography.Text>默认</Typography.Text>
                  <Switch
                    checked={component.default}
                    onChange={defaultValue => {
                      updateComponent(groupIndex, componentIndex, {default: defaultValue});
                      onDirty();
                    }}
                    {...testId(`catalog-item-composite-component-default-${groupIndex}-${componentIndex}`)}
                  />
                </Space>
                <Button
                  danger
                  type="link"
                  onClick={() => {
                    updateGroup(groupIndex, {
                      components: group.components.filter((_, index) => index !== componentIndex),
                    });
                    onDirty();
                  }}
                  {...testId(`catalog-item-composite-component-remove-${groupIndex}-${componentIndex}`)}
                >
                  移除
                </Button>
              </Space>
            ))}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

function CompositeGroupsReadOnly({values}: {values: CatalogCompositeGroup[]}) {
  if (!values.length) return <EmptySection text="未维护套餐分组" />;
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId('catalog-item-composite-groups-readonly')}
    >
      {values.map(group => (
        <Card
          key={group.groupCode || group.groupName}
          size="small"
          title={<NameCodeText name={group.groupName || '未命名分组'} code={group.groupCode || undefined} />}
        >
          <Descriptions
            size="small"
            column={1}
            items={[
              {key: 'rule', label: '选择规则', children: group.selectionRule || '—'},
              {
                key: 'components',
                label: '组件',
                children: group.components.length ? (
                  <Space direction="vertical" size={2}>
                    {group.components.map((component, index) => (
                      <Typography.Text key={`${component.itemCode}-${index}`}>
                        {component.itemCode || '—'}
                        {component.skuCode ? ` / ${component.skuCode}` : ''}
                        {' · '}
                        {component.quantity} {component.unit}
                        {' · '}
                        {component.default ? '默认' : '可选'}
                        {' · '}
                        {money(component.extraPrice)}
                        {' · '}
                        {component.status || '—'}
                      </Typography.Text>
                    ))}
                  </Space>
                ) : (
                  '未添加组件'
                ),
              },
            ]}
          />
        </Card>
      ))}
    </Space>
  );
}

function CatalogAssetEditor({
  mediaDraft,
  mediaLimits,
  onStageMedia,
  onRemoveMedia,
  onMoveMedia,
  onSetPrimaryMedia,
}: {
  mediaDraft: MediaDraft[];
  mediaLimits?: CatalogMediaLimits;
  onStageMedia: (file: File, existingId?: string) => Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
}) {
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-media-editor')}>
      <Space style={{width: '100%', justifyContent: 'space-between'}}>
        <Typography.Text strong>商品图片</Typography.Text>
        <Typography.Text type="secondary">
          {mediaLimits
            ? [
                `${mediaDraft.length}/${mediaLimits.maxImageCount}（1 张主图 + `,
                `${Math.max(mediaLimits.maxImageCount - 1, 0)} 张附图） · 单张上限 `,
                `${Math.floor(mediaLimits.maxImageBytes / 1024 / 1024)}MB`,
              ].join('')
            : '媒体规则加载中'}
        </Typography.Text>
      </Space>
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={file => {
          void onStageMedia(file as File);
          return Upload.LIST_IGNORE;
        }}
        disabled={!mediaLimits || mediaDraft.length >= (mediaLimits?.maxImageCount ?? 0)}
        {...testId('catalog-item-media-upload')}
      >
        <Button disabled={!mediaLimits || mediaDraft.length >= (mediaLimits?.maxImageCount ?? 0)}>
          {!mediaLimits
            ? '媒体规则加载中'
            : mediaDraft.length >= mediaLimits.maxImageCount
              ? '已达图片上限'
              : '上传图片'}
        </Button>
      </Upload>
      <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-media-list')}>
        {mediaDraft.length === 0 && <EmptySection text="未配置图片" />}
        {mediaDraft.map((asset, index) => (
          <Space
            key={asset.id}
            align="start"
            style={{display: 'flex', border: '1px solid #f0f0f0', padding: 8, borderRadius: 6}}
            {...testId(`catalog-item-media-${index}`)}
          >
            {asset.assetRef ? (
              <CatalogAssetPreview
                assetRef={asset.assetRef}
                alt={`${index === 0 ? '主图' : `附图 ${index}`}预览`}
                width={96}
                height={72}
                testId={`catalog-item-media-preview-${index}`}
              />
            ) : (
              <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                <Typography.Text type="secondary">待上传</Typography.Text>
              </span>
            )}
            <Space direction="vertical" size={2} style={{minWidth: 220}}>
              <Typography.Text strong>{index === 0 ? '★ 主图' : `附图 ${index}`}</Typography.Text>
              <Typography.Text ellipsis={{tooltip: asset.fileName}}>{asset.fileName}</Typography.Text>
              <Typography.Text
                type={asset.status === 'FAILED' ? 'danger' : asset.status === 'UPLOADING' ? 'warning' : 'secondary'}
                {...testId(`catalog-item-media-status-${index}`)}
              >
                {asset.status === 'UPLOADING'
                  ? '上传中/处理中'
                  : asset.status === 'FAILED'
                    ? (asset.error ?? '上传失败')
                    : asset.assetRef
                      ? '可用'
                      : '待上传'}
              </Typography.Text>
            </Space>
            <Space wrap>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={file => {
                  void onStageMedia(file as File, asset.id);
                  return Upload.LIST_IGNORE;
                }}
                disabled={asset.status === 'UPLOADING'}
              >
                <Button
                  size="small"
                  disabled={asset.status === 'UPLOADING'}
                  {...testId(`catalog-item-media-replace-${index}`)}
                >
                  替换
                </Button>
              </Upload>
              {asset.status === 'FAILED' && asset.file && (
                <Button
                  size="small"
                  onClick={() => void onStageMedia(asset.file as File, asset.id)}
                  {...testId(`catalog-item-media-retry-${index}`)}
                >
                  重试
                </Button>
              )}
              {index > 0 && (
                <Button
                  size="small"
                  onClick={() => onMoveMedia(asset.id, -1)}
                  {...testId(`catalog-item-media-move-up-${index}`)}
                >
                  上移
                </Button>
              )}
              {index < mediaDraft.length - 1 && (
                <Button
                  size="small"
                  onClick={() => onMoveMedia(asset.id, 1)}
                  {...testId(`catalog-item-media-move-down-${index}`)}
                >
                  下移
                </Button>
              )}
              {index > 0 && (
                <Button
                  size="small"
                  onClick={() => onSetPrimaryMedia(asset.id)}
                  {...testId(`catalog-item-media-set-primary-${index}`)}
                >
                  设为主图
                </Button>
              )}
              <Button
                size="small"
                danger
                disabled={index === 0 && mediaDraft.length > 1}
                onClick={() => void onRemoveMedia(asset.id, index)}
                {...testId(`catalog-item-media-remove-${index}`)}
              >
                移除
              </Button>
            </Space>
          </Space>
        ))}
      </Space>
    </Space>
  );
}

function CatalogAssetGallery({assetRefs, itemName}: {assetRefs: string[]; itemName: string}) {
  return (
    <Space wrap size={8} {...testId('catalog-item-media-gallery')}>
      {assetRefs.length
        ? assetRefs.map((assetRef, index) => (
            <Space direction="vertical" size={2} key={`${assetRef}-${index}`}>
              <CatalogAssetPreview
                assetRef={assetRef}
                alt={`${itemName}${index === 0 ? '主图' : `附图 ${index}`}预览`}
                width={160}
                height={120}
                testId={`catalog-item-media-gallery-${index}`}
              />
              <Typography.Text type="secondary">{index === 0 ? '主图' : `附图 ${index}`}</Typography.Text>
            </Space>
          ))
        : '未配置图片'}
    </Space>
  );
}

function EmptySection({text}: {text: string}) {
  return <Typography.Text type="secondary">{displayValue(text as JsonValue)}</Typography.Text>;
}
function money(value: number | null) {
  return value === null ? '—' : `¥${(value / 100).toFixed(2)}`;
}
function AttributesKeyValueEditor({
  value,
  onChange,
  onDirty,
}: {
  value?: CatalogAttributeDraftRow[];
  onChange?: (next: CatalogAttributeDraftRow[]) => void;
  onDirty: () => void;
}) {
  const [rows, setRows] = useState<CatalogAttributeDraftRow[]>(() => value ?? []);
  useEffect(() => setRows(value ?? []), [value]);
  const commit = (next: CatalogAttributeDraftRow[]) => {
    setRows(next);
    onChange?.(next);
    onDirty();
  };
  return (
    <Space
      direction="vertical"
      size={8}
      style={{display: 'flex'}}
      {...testId('catalog-item-attributes-key-value-editor')}
    >
      {rows.map((row, index) => (
        <Space key={index} align="start" style={{display: 'flex'}}>
          <Input
            addonBefore="键"
            value={row.key}
            onChange={event =>
              commit(rows.map((entry, rowIndex) => (rowIndex === index ? {...entry, key: event.target.value} : entry)))
            }
          />
          <Input
            addonBefore="值"
            value={row.value}
            onChange={event =>
              commit(
                rows.map((entry, rowIndex) => (rowIndex === index ? {...entry, value: event.target.value} : entry)),
              )
            }
          />
          <Button type="link" danger onClick={() => commit(rows.filter((_, rowIndex) => rowIndex !== index))}>
            删除
          </Button>
        </Space>
      ))}
      <Button type="dashed" onClick={() => commit([...rows, {key: '', value: ''}])}>
        新增属性
      </Button>
    </Space>
  );
}
function FactMap({value, empty}: {value: Record<string, JsonValue>; empty: string}) {
  const entries = Object.entries(value);
  return entries.length ? (
    <Descriptions
      {...adminWideDetailDescriptionsProps}
      items={entries.map(([key, entry]) => ({key, label: key, children: displayValue(entry)}))}
    />
  ) : (
    <EmptySection text={empty} />
  );
}
