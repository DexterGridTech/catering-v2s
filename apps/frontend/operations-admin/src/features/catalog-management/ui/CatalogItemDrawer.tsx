import {
  Alert,
  Button,
  Card,
  Checkbox,
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
  Radio,
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
import {ProList} from '@ant-design/pro-components';
import {
  adminWideDetailDescriptionsProps,
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  DescriptorFieldRenderer,
  digestFileContent,
  NameCodeText,
  testId,
  useCursorCandidates,
  useDrawerFormLifecycle,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import type {DescriptorTreeNode, DrawerLifecycleDiagnosticEvent} from '@catering-v2s/admin-ui-foundation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type UIEvent,
} from 'react';
import {
  operationsContentTabRefreshSignal,
  operationsLogger,
  operationsProblemOf,
  operationsRtk,
} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogItemSaveRequest,
  type CatalogShapeManifestView,
  type CatalogUnitList,
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
  CatalogAttributeAssignment,
  CatalogDetail,
  CatalogIdentifier,
  CatalogIdentifierType,
  CatalogInventoryRuleNode,
  CatalogNavigation,
  CatalogOrderOptionConfig,
  CatalogPreparationEffect,
  CatalogPreparationProfile,
  CatalogSkuRow,
  CatalogSkuVariantDimension,
} from '../model/catalogModel';
import {
  buildCatalogSkuVoidRequest,
  buildSkuMatrix,
  catalogCentsToYuan,
  catalogDetailImageRefs,
  catalogFormValidationIssue,
  catalogInventoryProblemTab,
  catalogSkuIssueCodes,
  decodeCatalogMediaLimits,
  decodeDetail,
  decodeItems,
  decodeNavigation,
  displayValue,
  catalogInventoryRuleToDraft,
  mergeCatalogSkuVoidReadback,
  serializeSkuRowsForSave,
  catalogYuanToCents,
  shouldHydrateCatalogItemDraft,
  type CatalogMediaLimits,
} from '../model/catalogModel';
import {
  CATALOG_IDENTIFIER_TYPE_LABELS,
  catalogIdentifierProblemFeedback,
} from '../model/catalogIdentificationPreparationFeedback';
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
} from './CatalogDictionaryDrawer';
import {LocalCatalogCopyDrawer} from './LocalCatalogCopyDrawer';
import {CatalogAssetPreview} from './CatalogAssetPreview';
import {CatalogInventoryBomWorkbench} from './CatalogInventoryBomWorkbench';

type Props = {
  itemCode?: string;
  initialMode?: 'view' | 'edit';
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWriteCatalog: boolean;
  surface: 'store' | 'brand';
  navigation?: CatalogNavigation;
  onOpenProductionTags?: () => void;
  dictionaryRevision?: Partial<Record<DictionaryKind, number>>;
  onVoidAndRebuild?: (source: {code: string; name: string; shapeKey: string}) => void;
  onClose: () => void;
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
type SkuDimensionDraft = CatalogSkuVariantDimension;
type CatalogIdentifierDraft = CatalogIdentifier & {editorId: string};
type PreparationProfileDraft = CatalogPreparationProfile;
type SkuRowDraft = CatalogSkuRow & {editorId: string};
type CatalogDictionaryQuickManageKind = Exclude<DictionaryKind, 'PRODUCTION_TAG'>;
type ProductionTagOption = {tagRef: string; code: string; name: string; owner: string; status?: string};
type PromotionFormValues = Pick<
  TemporaryPromotionPreflightRequest,
  'formalCode' | 'shapeKey' | 'name' | 'shortName' | 'materialRole'
>;
type CatalogManifest = Pick<
  CatalogShapeManifestView,
  'enumLabels' | 'fields' | 'fieldRules' | 'tabRules' | 'typeEffects' | 'identifierRules' | 'preparationRules'
>;
type CatalogUnitOption = CatalogUnitList['data']['units'][number];
// These values stay inside an incomplete editor draft. They are validated by
// wireUuid only when a request is assembled for a generated endpoint.
const draftUuid = (value = ''): ReturnType<typeof wireUuid> => value as ReturnType<typeof wireUuid>;

function clonePreparationProfile(value: PreparationProfileDraft | null): PreparationProfileDraft | null {
  return value
    ? {
        ...value,
        productionTagRefs: [...value.productionTagRefs],
      }
    : null;
}
function cloneSkuDimensions(value: SkuDimensionDraft[]): SkuDimensionDraft[] {
  return value.map(dimension => ({...dimension, values: dimension.values.map(entry => ({...entry}))}));
}
export function cloneSkuRows(value: CatalogSkuRow[]): CatalogSkuRow[] {
  return value.map(sku => ({
    ...sku,
    attributeValueRefs: sku.attributeValueRefs.map(entry => ({...entry})),
    identifiers: sku.identifiers.map(entry => ({...entry})),
    preparationOverride: {
      mode: sku.preparationOverride.mode,
      profile: clonePreparationProfile(sku.preparationOverride.profile),
    },
    effectivePreparation: clonePreparationProfile(sku.effectivePreparation),
    mediaRefs: [...sku.mediaRefs],
  }));
}
export type CatalogPreparationLayout = 'ITEM_ONLY' | 'SKU' | 'OPTIONS' | 'SKU_AND_OPTIONS';
export function catalogPreparationLayout(
  shapeKey: string,
  skuCount: number,
  optionEffectCount: number,
): CatalogPreparationLayout {
  const hasSkuVariation = shapeKey === 'SKU_VARIANT_SALE_COUNTED' && skuCount > 0;
  const hasOptionVariation = optionEffectCount > 0;
  if (hasSkuVariation && hasOptionVariation) return 'SKU_AND_OPTIONS';
  if (hasSkuVariation) return 'SKU';
  if (hasOptionVariation) return 'OPTIONS';
  return 'ITEM_ONLY';
}
export function skuPreparationOverrideForMode(
  mode: CatalogSkuRow['preparationOverride']['mode'],
  profile: PreparationProfileDraft | null,
): CatalogSkuRow['preparationOverride'] {
  return {mode, profile: mode === 'OVERRIDE' ? clonePreparationProfile(profile) : null};
}
export function buildAdditivePreparationEffect(
  identity: Pick<CatalogPreparationEffect, 'definitionValueRef' | 'optionGroupDisplayOrder' | 'optionValueDisplayOrder'>,
  current: CatalogPreparationEffect | null,
  patch: Partial<Pick<CatalogPreparationEffect, 'addProductionTagRefs' | 'instruction' | 'preparationSecondsDelta'>>,
): CatalogPreparationEffect | null {
  const next = {
    definitionValueRef: identity.definitionValueRef,
    optionGroupDisplayOrder: identity.optionGroupDisplayOrder,
    optionValueDisplayOrder: identity.optionValueDisplayOrder,
    addProductionTagRefs: patch.addProductionTagRefs ?? current?.addProductionTagRefs ?? [],
    instruction: patch.instruction !== undefined ? patch.instruction : current?.instruction ?? null,
    preparationSecondsDelta:
      patch.preparationSecondsDelta !== undefined
        ? patch.preparationSecondsDelta
        : current?.preparationSecondsDelta ?? null,
  } satisfies CatalogPreparationEffect;
  return next.addProductionTagRefs.length || Boolean(next.instruction) || next.preparationSecondsDelta !== null
    ? next
    : null;
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
  attributeAssignments: '商品属性',
  identifiers: '标识与条码',
  categoryRef: '分类',
  tagRefs: '商品标签',
  salesUnitRef: '销售单位',
  baseMeasureUnitRef: '基础计量单位',
  standardSalePrice: '商品标准价',
  images: '图片资产',
  preparationProfile: '制作信息',
  skuVariantDimensions: 'SKU 规格维度',
  skuVariantAttribute: 'SKU 规格属性',
  skuVariantValues: 'SKU 规格值',
  skuMatrix: 'SKU 矩阵',
  skus: 'SKU 矩阵',
  orderOptionConfigs: '点单选项',
  inventoryBomComponent: '耗用对象',
  inventoryRules: '库存与 BOM',
  compositeComponentSku: '套餐组件 SKU',
  compositeGroups: '套餐内容',
};

function deniedFieldLabel(manifest: CatalogManifest | undefined, fieldKey: string) {
  const label = catalogDeniedFieldLabels[fieldKey] ?? catalogFieldLabel(manifest, fieldKey);
  return label === fieldKey ? '上游维护字段' : label;
}

function catalogUnitLabel(unit?: {name: string; code: string} | null) {
  return unit ? <NameCodeText name={unit.name} code={unit.code} /> : '—';
}

export function manifestIdentifierTypes(
  manifest: CatalogManifest | undefined,
  shapeKey: string,
  grain: 'CATALOG_ITEM' | 'SKU',
): CatalogIdentifierType[] {
  const admission = manifest?.identifierRules?.admission;
  if (!admission || typeof admission !== 'object' || Array.isArray(admission)) return [];
  const shape = (admission as Record<string, unknown>)[shapeKey];
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return [];
  const grainRule = (shape as Record<string, unknown>)[grain];
  if (!grainRule || typeof grainRule !== 'object' || Array.isArray(grainRule)) return [];
  return Object.entries(grainRule)
    .filter(([, allowed]) => allowed === true)
    .map(([value]) => value)
    .filter((value): value is CatalogIdentifierType => value in CATALOG_IDENTIFIER_TYPE_LABELS);
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
  initialMode = 'view',
  queryContext,
  brandRef,
  canWriteCatalog,
  surface,
  navigation,
  onOpenProductionTags,
  dictionaryRevision = {},
  onVoidAndRebuild,
  onClose,
}: Props) {
  void surface;
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [activeTab, setActiveTab] = useState('basic');
  const [problem, setProblem] = useState<string>();
  const [localCopyOpen, setLocalCopyOpen] = useState(false);
  const [dictionaryQuickManage, setDictionaryQuickManage] = useState<{
    kind: CatalogDictionaryQuickManageKind;
    dimensionIndex?: number;
    valueIndex?: number;
    parentEntryRef?: string;
  }>();
  const [localDictionaryRevisions, setLocalDictionaryRevisions] = useState<Partial<Record<DictionaryKind, number>>>({});
  const [selectedProductionTagRefs, setSelectedProductionTagRefs] = useState<string[]>([]);
  const [selectedProductionTags, setSelectedProductionTags] = useState<ProductionTagOption[]>([]);
  const [productionTagQuery, setProductionTagQuery] = useState('');
  const [selectedTagRefs, setSelectedTagRefs] = useState<string[]>([]);
  const [selectedSalesUnitRef, setSelectedSalesUnitRef] = useState<string>();
  const [selectedBaseMeasureUnitRef, setSelectedBaseMeasureUnitRef] = useState<string>();
  const initializedDraftItem = useRef<string | undefined>(undefined);
  const hydrateDraftAfterSave = useRef(false);
  const drawerOperationInstanceId = useRef<string | undefined>(undefined);
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
  const [categoryRefDraft, setCategoryRefDraft] = useState<string>();
  const [attributeAssignmentsDraft, setAttributeAssignmentsDraft] = useState<CatalogAttributeAssignment[]>([]);
  const [orderOptionConfigsDraft, setOrderOptionConfigsDraft] = useState<CatalogOrderOptionConfig[]>([]);
  const [standardSalePriceDraft, setStandardSalePriceDraft] = useState<number | null>(null);
  const [preparationProfileDraft, setPreparationProfileDraft] = useState<PreparationProfileDraft | null>(null);
  const [inventoryRulesDraft, setInventoryRulesDraft] = useState<CatalogInventoryRuleNode[]>([]);
  const [compositeGroupsDraft, setCompositeGroupsDraft] = useState<CatalogCompositeGroup[]>([]);
  const [skuVariantDimensionsDraft, setSkuVariantDimensionsDraft] = useState<SkuDimensionDraft[]>([]);
  const [skusDraft, setSkusDraft] = useState<SkuRowDraft[]>([]);
  const [promotion, setPromotion] = useState<TemporaryPromotionPreflight['data']>();
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionProblem, setPromotionProblem] = useState<string>();
  const [voidingSkuRef, setVoidingSkuRef] = useState<string>();
  const [form] = Form.useForm<{displayName: string; shortName?: string}>();
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
  const productionTagCandidates = useCursorCandidates<ProductionTagOption>({
    queryText: productionTagQuery,
    resetKey: `${itemCode ?? ''}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}`,
    pageSize: 50,
    keyOf: tag => tag.tagRef,
  });
  const productionTagsRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsProductionTags(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            usage: 'BINDABLE_CANDIDATE',
            ...(productionTagCandidates.debouncedQueryText
              ? {query: productionTagCandidates.debouncedQueryText}
              : {}),
            ...(productionTagCandidates.cursor ? {cursor: productionTagCandidates.cursor} : {}),
            pageSize: productionTagCandidates.pageSize,
          },
          headers,
        },
      ),
    [
      headers,
      productionTagCandidates.cursor,
      productionTagCandidates.debouncedQueryText,
      productionTagCandidates.pageSize,
      queryContext.scopeRef,
    ],
  );
  const productionTagsQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionTagsRequest, {
    skip: !itemCode || !canWriteCatalog,
  });
  const productionTagPage = productionTagsQuery.currentData?.data;
  const acceptProductionTagPage = productionTagCandidates.acceptPage;
  const productionTagPageSize = productionTagCandidates.pageSize;
  useEffect(() => {
    if (!productionTagPage) return;
    acceptProductionTagPage(
      productionTagPage.entries.map(entry => ({
        tagRef: entry.tagRef,
        code: entry.code,
        name: entry.name,
        owner: 'fulfillment-production',
        status: entry.status,
      })),
      {
        pageSize: productionTagPageSize,
        total: productionTagPage.total,
        nextCursor: productionTagPage.cursor,
      },
    );
  }, [acceptProductionTagPage, productionTagPage, productionTagPageSize]);
  const availableProductionTags = productionTagCandidates.items;
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
  const onLifecycleDiagnostic = useCallback((event: DrawerLifecycleDiagnosticEvent) => {
    drawerOperationInstanceId.current = event.operationInstanceId;
    operationsLogger.info({
      event: 'catalog.item.editor.lifecycle',
      phase: event.phase,
      outcome: event.outcome,
      operationId: event.operationId,
      operationInstanceId: event.operationInstanceId,
    });
  }, []);
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(itemCode),
    onOpenChange: open => {
      if (!open) void closeAfterStagedRelease();
    },
    dirtyMessage: '商品编辑内容尚未保存。',
    dirtyGuardTestIds: {confirm: testId('catalog-item-dirty-discard'), cancel: testId('catalog-item-dirty-continue')},
    diagnosticOperationId: 'catalog-item-editor',
    onDiagnosticEvent: onLifecycleDiagnostic,
  });
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const lastContentTabRefreshVersion = useRef(contentTabRefreshVersion);
  const refetchDetail = detailQuery.refetch;
  const refetchManifest = manifestQuery.refetch;
  const refetchProductionTags = productionTagsQuery.refetch;
  useEffect(() => {
    if (!itemCode || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
    lastContentTabRefreshVersion.current = contentTabRefreshVersion;
    // A shell refresh must update the server read model without overwriting a
    // dirty editor draft. Clean drawers opt into hydration after the refetch;
    // the existing hydration guard keeps unsaved edits intact.
    if (!lifecycle.dirty) hydrateDraftAfterSave.current = true;
    operationsLogger.info({
      event: 'catalog.item.editor.content_refresh',
      phase: 'READ_MODEL_REFRESH',
      outcome: 'STARTED',
      operationId: 'catalog-item-editor',
      operationInstanceId: drawerOperationInstanceId.current,
    });
    void refetchDetail();
    void refetchManifest();
    if (canWriteCatalog) void refetchProductionTags();
  }, [
    canWriteCatalog,
    contentTabRefreshVersion,
    itemCode,
    lifecycle.dirty,
    refetchDetail,
    refetchManifest,
    refetchProductionTags,
  ]);
  useEffect(() => {
    if (itemCode) setMode(initialMode);
  }, [initialMode, itemCode]);
  useEffect(() => {
    if (!detail) {
      operationsLogger.debug({
        event: 'catalog.item.editor.draft.hydration.waiting_detail',
        phase: 'DRAFT_HYDRATION',
        outcome: 'WAITING',
        operationId: 'catalog-item-editor',
        operationInstanceId: drawerOperationInstanceId.current,
      });
      return;
    }
    const shouldHydrate = shouldHydrateCatalogItemDraft({
      initializedItemCode: initializedDraftItem.current,
      detailItemCode: detail.item.code,
      dirty: lifecycle.dirty,
      forceHydrate: hydrateDraftAfterSave.current,
    });
    if (!shouldHydrate) {
      operationsLogger.debug({
        event: lifecycle.dirty
          ? 'catalog.item.editor.draft.hydration.skipped_dirty'
          : 'catalog.item.editor.draft.hydration.skipped_same_item',
        phase: 'DRAFT_HYDRATION',
        outcome: 'SKIPPED',
        operationId: 'catalog-item-editor',
        operationInstanceId: drawerOperationInstanceId.current,
      });
      return;
    }
    operationsLogger.info({
      event: 'catalog.item.editor.draft.hydrated',
      phase: 'DRAFT_HYDRATION',
      outcome: 'SUCCEEDED',
      operationId: 'catalog-item-editor',
      operationInstanceId: drawerOperationInstanceId.current,
    });
    initializedDraftItem.current = detail.item.code;
    hydrateDraftAfterSave.current = false;
    form.setFieldsValue({
      displayName: detail.item.name,
      shortName: detail.item.shortName ?? '',
    });
    setIdentifierDraft(detail.item.identifiers.map(entry => ({...entry, editorId: createDraftRowId('identifier')})));
    setCategoryRefDraft(detail.item.categoryRef ?? undefined);
    setAttributeAssignmentsDraft(
      detail.item.attributeAssignments.map(assignment => ({...assignment, optionRefs: [...assignment.optionRefs]})),
    );
    setOrderOptionConfigsDraft(
      detail.item.orderOptionConfigs.map(config => ({
        ...config,
        values: config.values.map(value => ({
          ...value,
        })),
      })),
    );
    setStandardSalePriceDraft(detail.item.standardSalePrice ?? null);
    setSelectedTagRefs([...detail.item.tagRefs]);
    setSelectedSalesUnitRef(detail.item.salesUnitRef ?? undefined);
    setSelectedBaseMeasureUnitRef(detail.item.baseMeasureUnitRef ?? undefined);
    setPreparationProfileDraft(clonePreparationProfile(detail.item.preparationProfile));
    setInventoryRulesDraft(
      detail.inventoryRules.nodes.map(node => ({
        ...node,
        owner: {...node.owner},
        allowedModes: [...node.allowedModes],
        directConfiguration: node.directConfiguration ? {...node.directConfiguration} : null,
        bom: node.bom
          ? {
              version: node.bom.version,
              lines: node.bom.lines.map(line => ({
                ...line,
                consumptionUnitSnapshot: {...line.consumptionUnitSnapshot},
              })),
            }
          : null,
      })),
    );
    setCompositeGroupsDraft(
      detail.compositeGroups.map(group => ({...group, components: group.components.map(entry => ({...entry}))})),
    );
    setSkuVariantDimensionsDraft(cloneSkuDimensions(detail.item.skuVariantDimensions));
    setSkusDraft(normalizeSkuDraftRows(cloneSkuRows(detail.item.skus)));
    if (initializedProductionItem.current !== detail.item.code) {
      initializedProductionItem.current = detail.item.code;
      setSelectedProductionTagRefs(detail.item.preparationProfile?.productionTagRefs ?? []);
      setSelectedProductionTags(detail.productionTags);
    }
    if (initializedMediaItem.current !== detail.item.code) {
      initializedMediaItem.current = detail.item.code;
      const imageRefs = catalogDetailImageRefs(detail.item);
      setMediaDraft(
        imageRefs.map((assetRef, index) => ({
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
  }, [createDraftRowId, detail, form, lifecycle, mode, normalizeSkuDraftRows]);
  useEffect(() => {
    if (!(problem || detailQuery.error || mediaProblem)) return;
    window.requestAnimationFrame(() => problemRef.current?.focus());
  }, [detailQuery.error, mediaProblem, problem]);
  useEffect(() => {
    if (!itemCode) {
      // The Drawer stays mounted while hidden, so closing it must clear every
      // local draft before the next open. Clearing only the basic fields lets
      // the previous product's attributes/order options leak into a new edit.
      initializedDraftItem.current = undefined;
      hydrateDraftAfterSave.current = false;
      drawerOperationInstanceId.current = undefined;
      initializedProductionItem.current = undefined;
      initializedMediaItem.current = undefined;
      setMode('view');
      setActiveTab('basic');
      setProblem(undefined);
      setMediaProblem(undefined);
      setReleaseCloseFailed(false);
      setReleasingBeforeClose(false);
      setMediaDraft([]);
      setSkuStagedMedia([]);
      setIdentifierDraft([]);
      setCategoryRefDraft(undefined);
      setAttributeAssignmentsDraft([]);
      setOrderOptionConfigsDraft([]);
      setStandardSalePriceDraft(null);
      setSelectedTagRefs([]);
      setSelectedSalesUnitRef(undefined);
      setSelectedBaseMeasureUnitRef(undefined);
      setSelectedProductionTagRefs([]);
      setSelectedProductionTags([]);
      setProductionTagQuery('');
      setPreparationProfileDraft(null);
      setInventoryRulesDraft([]);
      setCompositeGroupsDraft([]);
      setSkuVariantDimensionsDraft([]);
      setSkusDraft([]);
      setLocalCopyOpen(false);
      setDictionaryQuickManage(undefined);
      setLocalDictionaryRevisions({});
      setPromotion(undefined);
      setPromotionOpen(false);
      setPromotionProblem(undefined);
      setVoidingSkuRef(undefined);
      form.resetFields();
      promotionForm.resetFields();
      lifecycle.reset();
    }
  }, [form, itemCode, lifecycle, promotionForm]);

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
    let values: {displayName: string; shortName?: string};
    try {
      values = await form.validateFields();
    } catch (error) {
      const issue = catalogFormValidationIssue(error);
      setActiveTab(issue?.tabKey ?? 'basic');
      setProblem(issue?.message ?? '请先修正商品基础信息后再保存。');
      return;
    }
    const visibleTabs = new Set(detail.tabs.filter(tab => tab.visible).map(tab => tab.tabKey));
    if (visibleTabs.has('identifiers')) {
      const invalidIndex = identifierDraft.findIndex(entry => !entry.identifierType || !entry.identifierValue.trim());
      if (invalidIndex >= 0) {
        setActiveTab('identifiers');
        setProblem(`条码与标识第 ${invalidIndex + 1} 行请填写识别方式和识别值。`);
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
      const invalidNode = inventoryRulesDraft.findIndex(node => {
        if (node.mode === 'NONE') return false;
        if (node.mode === 'DIRECT') return !node.directConfiguration;
        if (node.mode === 'BOM') {
          return (
            !node.bom?.lines.length ||
            node.bom.lines.some(line => !line.targetRef || !line.itemRef || !line.quantity.trim())
          );
        }
        return true;
      });
      if (invalidNode >= 0) {
        setActiveTab('inventory-bom');
        setProblem(`库存/BOM 第 ${invalidNode + 1} 个节点缺少库存对象或消耗数量，请选择已有库存对象。`);
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
        images: mediaDraft
          .filter(asset => (asset.status === 'READY' || asset.status === 'FAILED') && asset.assetRef)
          .map(asset => wireUuid(asset.assetRef)),
        tagRefs: selectedTagRefs.map(ref => wireUuid(ref)),
        salesUnitRef: selectedSalesUnitRef ? wireUuid(selectedSalesUnitRef) : null,
        baseMeasureUnitRef: selectedBaseMeasureUnitRef ? wireUuid(selectedBaseMeasureUnitRef) : null,
        categoryRef: categoryRefDraft ? wireUuid(categoryRefDraft) : null,
        attributeAssignments: attributeAssignmentsDraft.map(assignment => ({
          definitionRef: wireUuid(assignment.definitionRef),
          textValue: assignment.textValue,
          optionRefs: assignment.optionRefs.map(ref => wireUuid(ref)),
        })),
        orderOptionConfigs: orderOptionConfigsDraft.map(config => ({
          definitionRef: wireUuid(config.definitionRef),
          displayOrder: config.displayOrder,
          required: config.required,
          minSelectionCount: config.selectionMode === 'MULTIPLE' ? config.minSelectionCount : null,
          maxSelectionCount: config.selectionMode === 'MULTIPLE' ? config.maxSelectionCount : null,
          values: config.values.map(value => ({
            definitionValueRef: wireUuid(value.definitionValueRef),
            defaultValue: value.defaultValue,
            extraPrice: value.extraPrice,
            expectedBomVersion: value.bomVersion ?? 0,
            preparationEffect: value.preparationEffect
              ? {
                  addProductionTagRefs: value.preparationEffect.addProductionTagRefs.map(ref => wireUuid(ref)),
                  instruction: value.preparationEffect.instruction,
                  preparationSecondsDelta: value.preparationEffect.preparationSecondsDelta,
                }
              : null,
          })),
        })),
      };
      if (visibleTabs.has('identifiers'))
        catalogDraft.identifiers = identifierDraft.map(entry => ({
          identifierType: entry.identifierType,
          identifierValue: entry.identifierValue,
        }));
      if (visibleTabs.has('basic') && detail.item.priceGranularity === 'ITEM')
        catalogDraft.standardSalePrice = standardSalePriceDraft;
      if (visibleTabs.has('sku-specifications-pricing')) {
        catalogDraft.skuVariantDimensions = skuVariantDimensionsDraft;
        catalogDraft.skus = serializeSkuRowsForSave(skusDraft.map(({editorId: _editorId, ...row}) => row));
      }
      if (visibleTabs.has('composite-content')) catalogDraft.compositeGroups = compositeGroupsDraft;
      if (visibleTabs.has('production-prompts'))
        catalogDraft.preparationProfile = preparationProfileDraft
          ? {
              ...preparationProfileDraft,
              productionTagRefs: selectedProductionTagRefs.map(ref => wireUuid(ref)),
            }
          : null;
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
          expectedCatalogVersion: detail.item.version,
          inventoryRules: {
            nodes: visibleTabs.has('inventory-bom') ? inventoryRulesDraft.map(catalogInventoryRuleToDraft) : [],
          },
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
    } catch (error) {
      const feedback = operationsProblemOf(error);
      const problemTab = catalogInventoryProblemTab(feedback.errorCode);
      const cipgFeedback = catalogIdentifierProblemFeedback(feedback.errorCode);
      if (cipgFeedback) {
        const cipgTab =
          cipgFeedback.target === 'optionPreparation'
            ? 'order-options'
            : cipgFeedback.target === 'skuIdentifier' || cipgFeedback.target === 'skuPreparation'
              ? 'sku-specifications-pricing'
              : cipgFeedback.target === 'identifier'
                ? 'identifiers'
                : 'production-prompts';
        setActiveTab(cipgTab);
        setProblem(cipgFeedback.message);
      } else {
        if (problemTab) setActiveTab(problemTab);
        setProblem(feedback.detail);
      }
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
          const body = buildCatalogSkuVoidRequest(detail.item, dataNodeRef, itemCode, sku, detail.inventoryRules);
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
        shortName: values.shortName?.trim() ?? '',
        materialRole: values.materialRole?.trim() ?? '',
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
        shortName: values.shortName?.trim() ?? '',
        materialRole: values.materialRole?.trim() ?? '',
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
    } else if (quickManage.kind === 'UNIT') {
      setSelectedSalesUnitRef(candidate.entryRef);
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
        file,
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
  const updateCategoryRef = (next: string | undefined) => {
    setCategoryRefDraft(next);
    lifecycle.setDirty(true);
  };
  const updateStandardSalePrice = (next: number | null) => {
    setStandardSalePriceDraft(next);
    lifecycle.setDirty(true);
  };
  const updatePreparationProfile = (next: PreparationProfileDraft | null) => {
    setPreparationProfileDraft(next);
    lifecycle.setDirty(true);
  };
  const updateInventoryRules = (next: CatalogInventoryRuleNode[]) => {
    setInventoryRulesDraft(next);
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
              productionTagsLoading={productionTagsQuery.isLoading || productionTagsQuery.isFetching}
              onProductionTagsSearch={setProductionTagQuery}
              onProductionTagsPopupScroll={event =>
                productionTagCandidates.onPopupScroll(event, productionTagsQuery.isFetching)
              }
              selectedProductionTagRefs={selectedProductionTagRefs}
              selectedProductionTags={selectedProductionTags}
              onProductionTagsChange={next => {
                setSelectedProductionTagRefs(next);
                setPreparationProfileDraft(current =>
                  current ? {...current, productionTagRefs: next.map(ref => wireUuid(ref))} : {
                    productionTagRefs: next.map(ref => wireUuid(ref)),
                    productionDisplayName: null,
                    estimatedPreparationSeconds: null,
                    preparationNotes: null,
                  },
                );
                lifecycle.setDirty(true);
              }}
              selectedTagRefs={selectedTagRefs}
              selectedSalesUnitRef={selectedSalesUnitRef}
              selectedBaseMeasureUnitRef={selectedBaseMeasureUnitRef}
              onTagRefsChange={next => {
                setSelectedTagRefs(next);
                lifecycle.setDirty(true);
              }}
              onSalesUnitRefChange={next => {
                setSelectedSalesUnitRef(next);
                lifecycle.setDirty(true);
              }}
              onBaseMeasureUnitRefChange={next => {
                setSelectedBaseMeasureUnitRef(next);
                lifecycle.setDirty(true);
              }}
              categoryRefDraft={categoryRefDraft}
              onCategoryRefChange={updateCategoryRef}
              attributeAssignmentsDraft={attributeAssignmentsDraft}
              onAttributeAssignmentsChange={next => {
                setAttributeAssignmentsDraft(next);
                lifecycle.setDirty(true);
              }}
              orderOptionConfigsDraft={orderOptionConfigsDraft}
              onOrderOptionConfigsChange={next => {
                setOrderOptionConfigsDraft(next);
                lifecycle.setDirty(true);
              }}
              identifierDraft={identifierDraft}
              createDraftRowId={createDraftRowId}
              standardSalePriceDraft={standardSalePriceDraft}
              preparationProfileDraft={preparationProfileDraft}
              inventoryRulesDraft={inventoryRulesDraft}
              compositeGroupsDraft={compositeGroupsDraft}
              skuVariantDimensionsDraft={skuVariantDimensionsDraft}
              skusDraft={skusDraft}
              queryContext={queryContext}
              brandRef={brandRef}
              currentItemCode={itemCode}
              dictionaryRevision={Object.fromEntries(
                Object.values([
                  'TAG',
                  'UNIT',
                  'SKU_ATTRIBUTE',
                  'SKU_ATTRIBUTE_VALUE',
                  'PRODUCTION_TAG',
                ] as DictionaryKind[]).map(kind => [kind, effectiveDictionaryRevision(kind)]),
              )}
              onIdentifiersChange={updateIdentifiers}
              onStandardSalePriceChange={updateStandardSalePrice}
              onPreparationProfileChange={updatePreparationProfile}
              onInventoryRulesChange={updateInventoryRules}
              onCompositeGroupsChange={updateCompositeGroups}
              onSkuVariantDimensionsChange={updateSkuVariantDimensions}
              onSkusChange={updateSkus}
              onDirty={() => lifecycle.setDirty(true)}
              onOpenProductionTags={onOpenProductionTags}
              onOpenDictionaryQuickManage={openDictionaryQuickManage}
              onVoidSku={voidSku}
              voidingSkuRef={voidingSkuRef}
              onNavigateTab={next => setActiveTab(next)}
            />
          ),
        }))
    : [];
  const action = detail?.actionAvailability;
  // AUTO_SYNC is not an all-field read-only mode: the owner supplies the exact
  // deniedFields set, so local supplements (tags, prompts, 商品属性等)
  // remain editable. Temporary items are the only whole-record read-only mode.
  const sourceLocked = detail ? detail.item.source === 'TEMPORARY' : false;
  const detailImageRefs = detail ? catalogDetailImageRefs(detail.item) : [];
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
            {detailImageRefs[0] && (
              <CatalogAssetPreview
                assetRef={detailImageRefs[0]}
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
      maskClosable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      {...testId('catalog-inventory-item-drawer')}
      extra={
        detail && (
          <Space>
            {mode === 'view' && canWriteCatalog && (
              <DisabledReasonButton
                disabled={!action?.canEdit || sourceLocked}
                reason={disabledActionReason(Boolean(action?.canEdit), '编辑', sourceLocked)}
                onClick={() => {
                  // A read-only session has no user-owned draft. Force the
                  // current owner readback through the edit hydration path so
                  // a prior cancelled session can never leave this form blank.
                  if (!lifecycle.dirty) initializedDraftItem.current = undefined;
                  operationsLogger.info({
                    event: 'catalog.item.editor.edit_requested',
                    phase: 'MODE_TRANSITION',
                    outcome: ['EDIT', 'REQUESTED'].join('_'),
                    operationId: 'catalog-item-editor',
                    operationInstanceId: drawerOperationInstanceId.current,
                  });
                  setMode('edit');
                }}
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
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} {...testId('catalog-item-tabs')} />
      )}
      <LocalCatalogCopyDrawer
        open={localCopyOpen}
        sourceItemCode={itemCode ?? ''}
        targetShapeKey={detail?.item.shapeKey}
        queryContext={queryContext}
        brandRef={brandRef}
        onClose={() => setLocalCopyOpen(false)}
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
        maskClosable={!executePromotionState.isLoading}
        keyboard={!executePromotionState.isLoading}
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
  productionTagsLoading,
  onProductionTagsSearch,
  onProductionTagsPopupScroll,
  selectedProductionTagRefs,
  selectedProductionTags,
  onProductionTagsChange,
  selectedTagRefs,
  selectedSalesUnitRef,
  selectedBaseMeasureUnitRef,
  onTagRefsChange,
  onSalesUnitRefChange,
  onBaseMeasureUnitRefChange,
  categoryRefDraft,
  onCategoryRefChange,
  attributeAssignmentsDraft,
  onAttributeAssignmentsChange,
  orderOptionConfigsDraft,
  onOrderOptionConfigsChange,
  identifierDraft,
  createDraftRowId,
  standardSalePriceDraft,
  preparationProfileDraft,
  inventoryRulesDraft,
  compositeGroupsDraft,
  skuVariantDimensionsDraft,
  skusDraft,
  queryContext,
  brandRef,
  currentItemCode,
  dictionaryRevision,
  onIdentifiersChange,
  onStandardSalePriceChange,
  onPreparationProfileChange,
  onInventoryRulesChange,
  onCompositeGroupsChange,
  onSkuVariantDimensionsChange,
  onSkusChange,
  onDirty,
  onOpenProductionTags,
  onOpenDictionaryQuickManage,
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
  form: ReturnType<typeof Form.useForm<{displayName: string; shortName?: string}>>[0];
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
  productionTagsLoading: boolean;
  onProductionTagsSearch: (value: string) => void;
  onProductionTagsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
  selectedProductionTagRefs: string[];
  selectedProductionTags: ProductionTagOption[];
  onProductionTagsChange: (next: string[]) => void;
  selectedTagRefs: string[];
  selectedSalesUnitRef?: string;
  selectedBaseMeasureUnitRef?: string;
  onTagRefsChange: (next: string[]) => void;
  onSalesUnitRefChange: (next: string | undefined) => void;
  onBaseMeasureUnitRefChange: (next: string | undefined) => void;
  categoryRefDraft?: string;
  onCategoryRefChange: (next: string | undefined) => void;
  attributeAssignmentsDraft: CatalogAttributeAssignment[];
  onAttributeAssignmentsChange: (next: CatalogAttributeAssignment[]) => void;
  orderOptionConfigsDraft: CatalogOrderOptionConfig[];
  onOrderOptionConfigsChange: (next: CatalogOrderOptionConfig[]) => void;
  identifierDraft: CatalogIdentifierDraft[];
  createDraftRowId: (prefix: string) => string;
  standardSalePriceDraft: number | null;
  preparationProfileDraft: PreparationProfileDraft | null;
  inventoryRulesDraft: CatalogInventoryRuleNode[];
  compositeGroupsDraft: CatalogCompositeGroup[];
  skuVariantDimensionsDraft: SkuDimensionDraft[];
  skusDraft: SkuRowDraft[];
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  dictionaryRevision: Partial<Record<DictionaryKind, number>>;
  onIdentifiersChange: (next: CatalogIdentifierDraft[]) => void;
  onStandardSalePriceChange: (next: number | null) => void;
  onPreparationProfileChange: (next: PreparationProfileDraft | null) => void;
  onInventoryRulesChange: (next: CatalogInventoryRuleNode[]) => void;
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
  const categoryNode = categoryRefDraft
    ? navigation?.tree.find(node => node.categoryRef === categoryRefDraft)
    : undefined;
  const categorySummary = !categoryRefDraft ? (
    <Typography.Text type="secondary">未分类</Typography.Text>
  ) : !navigation ? (
    <Typography.Text type="secondary">分类信息加载中</Typography.Text>
  ) : categoryNode ? (
    <NameCodeText name={categoryNode.name} code={categoryNode.code} />
  ) : (
    <Typography.Text type="secondary">分类信息暂不可用</Typography.Text>
  );
  const unitRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogUnits(
        {},
        {
          query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), includeInactive: false},
          headers: brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined,
        },
      ),
    [brandRef, queryContext.scopeRef],
  );
  const unitQuery = operationsRtk.useListOperationsCatalogUnitsQuery(unitRequest, {
    skip: !queryContext.scopeRef,
  });
  const unitOptions = unitQuery.currentData?.data.units ?? [];
  const referencePickerContexts = useMemo(
    () =>
      ({
        TAG: {
          scope: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), brandRef},
          readField: () => undefined,
          readSection: () => [],
          sectionRevision: () => `${detail.item.version}:${dictionaryRevision.TAG ?? 0}`,
        },
      }) satisfies Record<'TAG', CatalogFieldRuntimeContext>,
    [brandRef, detail.item.version, dictionaryRevision.TAG, queryContext.scopeRef],
  );
  if (tabKey === 'basic' && editing)
    return (
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
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
            value={categoryRefDraft}
            denied={detail.deniedFields.includes('categoryRef')}
            scopeRef={queryContext.scopeRef}
            brandRef={brandRef}
            version={detail.item.version}
            onChange={onCategoryRefChange}
            onDirty={onDirty}
          />
          {locked('categoryRef')}
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
          <Form.Item label={fieldLabel('salesUnitRef')} extra="商品销售单位只能选择一个；原料可以留空。">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={selectedSalesUnitRef}
              disabled={denied('salesUnitRef')}
              loading={unitQuery.isLoading || unitQuery.isFetching}
              options={unitOptions.map(unit => ({value: unit.unitRef, label: catalogUnitLabel(unit)}))}
              onChange={value => onSalesUnitRefChange(value)}
              {...testId('catalog-item-sales-unit')}
            />
          </Form.Item>
          {locked('salesUnitRef')}
          <Form.Item
            label={fieldLabel('baseMeasureUnitRef')}
            extra="基础计量单位决定库存消费单位；作为 BOM/库存对象时必须设置。"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={selectedBaseMeasureUnitRef}
              disabled={denied('baseMeasureUnitRef')}
              loading={unitQuery.isLoading || unitQuery.isFetching}
              options={unitOptions.map(unit => ({value: unit.unitRef, label: catalogUnitLabel(unit)}))}
              onChange={value => onBaseMeasureUnitRefChange(value)}
              {...testId('catalog-item-base-measure-unit')}
            />
          </Form.Item>
          {locked('baseMeasureUnitRef')}
          {detail.item.priceGranularity === 'ITEM' ? (
            <Form.Item label={fieldLabel('standardSalePrice')}>
              <InputNumber
                min={0}
                precision={2}
                step={0.01}
                suffix="元"
                value={catalogCentsToYuan(standardSalePriceDraft)}
                disabled={denied('standardSalePrice')}
                onChange={value => onStandardSalePriceChange(catalogYuanToCents(value))}
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
                  {detail.item.attributeAssignments.length} 个属性
                </Button>
              ),
            },
            {
              key: 'tagRefs',
              label: '商品标签',
              children: (
                <CatalogDescriptorPicker
                  manifest={manifest}
                  shapeKey={detail.item.shapeKey}
                  fieldKey="tagRefs"
                  value={selectedTagRefs}
                  context={referencePickerContexts.TAG}
                  readOnly
                  hideLabel
                  testIdValue="catalog-item-tag-refs-readonly"
                  onChange={() => undefined}
                />
              ),
            },
            {key: 'salesUnitRef', label: '销售单位', children: catalogUnitLabel(detail.item.salesUnit)},
            {key: 'baseMeasureUnitRef', label: '基础计量单位', children: catalogUnitLabel(detail.item.baseMeasureUnit)},
          ]}
        />
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {
              key: 'images',
              label: '图片资产',
              children: (
                <CatalogAssetGallery assetRefs={catalogDetailImageRefs(detail.item)} itemName={detail.item.name} />
              ),
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
            key: `${entry.identifierType}-${index}`,
            label: CATALOG_IDENTIFIER_TYPE_LABELS[entry.identifierType],
            children: (
              <Space>
                <Typography.Text>{entry.identifierValue}</Typography.Text>
                <Tag>商品</Tag>
              </Space>
            ),
          }))}
        />
      </Space>
    ) : (
      <IdentifierEditor
        values={identifierDraft}
        allowedTypes={manifestIdentifierTypes(manifest, detail.item.shapeKey, 'CATALOG_ITEM')}
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
          key: `${entry.identifierType}-${index}`,
          label: CATALOG_IDENTIFIER_TYPE_LABELS[entry.identifierType],
          children: (
            <Space>
              <Typography.Text>{entry.identifierValue}</Typography.Text>
              <Tag>商品</Tag>
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
        allowedIdentifierTypes={manifestIdentifierTypes(manifest, detail.item.shapeKey, 'SKU')}
        itemDefaultPreparation={preparationProfileDraft}
        availableProductionTags={availableProductionTags}
        selectedProductionTags={selectedProductionTags}
        productionTagsLoading={productionTagsLoading}
        onProductionTagsSearch={onProductionTagsSearch}
        onProductionTagsPopupScroll={onProductionTagsPopupScroll}
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
        unitOptions={unitOptions}
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
    return denied('attributeAssignments') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('attributeAssignments')}
        <AttributeAssignmentsReadOnly values={detail.item.attributeAssignments} />
      </Space>
    ) : (
      <AttributeAssignmentsEditor
        values={attributeAssignmentsDraft}
        onChange={onAttributeAssignmentsChange}
        onDirty={onDirty}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
      />
    );
  if (tabKey === 'attributes') return <AttributeAssignmentsReadOnly values={detail.item.attributeAssignments} />;
  if (tabKey === 'order-options' && editing)
    return denied('orderOptionConfigs') ? (
      <Space direction="vertical" style={{display: 'flex'}}>
        {locked('orderOptionConfigs')}
        <OrderOptionConfigurationsReadOnly values={detail.item.orderOptionConfigs} />
      </Space>
    ) : (
      <OrderOptionConfigurationsEditor
        values={orderOptionConfigsDraft}
        onChange={onOrderOptionConfigsChange}
        onDirty={onDirty}
        scopeRef={queryContext.scopeRef}
        brandRef={brandRef}
        availableProductionTags={availableProductionTags}
        selectedProductionTags={selectedProductionTags}
        productionTagsLoading={productionTagsLoading}
        onProductionTagsSearch={onProductionTagsSearch}
        onProductionTagsPopupScroll={onProductionTagsPopupScroll}
      />
    );
  if (tabKey === 'order-options') return <OrderOptionConfigurationsReadOnly values={detail.item.orderOptionConfigs} />;
  if (tabKey === 'production-prompts') {
    const detailProductionTags: ProductionTagOption[] = detail.productionTags.map(tag => ({...tag}));
    const tagMap = new Map<string, ProductionTagOption>(
      [...detailProductionTags, ...availableProductionTags, ...selectedProductionTags].map(tag => [tag.tagRef, tag]),
    );
    const selectedTags = selectedProductionTagRefs.map(
      tagRef => tagMap.get(tagRef) ?? {
        tagRef,
        code: '',
        name: '已维护的制作处理标签',
        owner: 'fulfillment-production',
        status: 'DISABLED',
      },
    );
    const options = Array.from(tagMap.values()).map(tag => ({
      label: tag.name || tag.code || '已维护的制作处理标签',
      value: tag.tagRef,
      disabled: tag.status !== undefined && tag.status !== 'ENABLED',
    }));
    return (
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {editing && canWriteCatalog && !denied('preparationProfile') ? (
          <PreparationProfileEditor
            profile={preparationProfileDraft}
            selectedTagRefs={selectedProductionTagRefs}
            selectedTags={selectedTags}
            tagOptions={options}
            tagsLoading={productionTagsLoading}
            onTagsSearch={onProductionTagsSearch}
            onTagsPopupScroll={onProductionTagsPopupScroll}
            onTagsChange={onProductionTagsChange}
            onChange={onPreparationProfileChange}
            onDirty={onDirty}
          />
        ) : (
          <>
            {denied('preparationProfile') && locked('preparationProfile')}
            <PreparationProfileReadOnly profile={detail.item.preparationProfile} tags={selectedTags} />
          </>
        )}
        {!editing && onOpenProductionTags && (
          <Button type="link" onClick={onOpenProductionTags} {...testId('catalog-production-tag-owner-open')}>
            管理制作处理标签
          </Button>
        )}
        <PreparationVariationSummary
          skus={skusDraft}
          orderOptions={orderOptionConfigsDraft}
          shapeKey={detail.item.shapeKey}
          onNavigateToOptions={() => onNavigateTab('order-options')}
        />
      </Space>
    );
  }
  if (tabKey === 'inventory-bom') {
    const inventoryRulesDenied = denied('inventoryRules');
    return (
      <Space direction="vertical" style={{display: 'flex'}}>
        {inventoryRulesDenied && locked('inventoryRules')}
        <CatalogInventoryBomWorkbench
          shapeKey={detail.item.shapeKey}
          nodes={inventoryRulesDenied ? detail.inventoryRules.nodes : inventoryRulesDraft}
          editing={editing && !inventoryRulesDenied}
          scopeRef={queryContext.scopeRef}
          brandRef={brandRef}
          unitOptions={unitOptions}
          baseUnitForOwner={node =>
            node.owner.ownerType === 'ITEM'
              ? detail.item.baseMeasureUnit
              : node.owner.ownerType === 'SKU'
                ? (detail.item.skus.find(sku => sku.productSkuRef === node.owner.productSkuRef)?.baseMeasureUnit ??
                  null)
                : null
          }
          onChange={onInventoryRulesChange}
          onDirty={onDirty}
        />
      </Space>
    );
  }
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
  value?: string;
  denied: boolean;
  scopeRef?: string;
  brandRef?: string;
  version: number;
  onChange: (next: string | undefined) => void;
  onDirty: () => void;
}) {
  const field = useMemo(
    () => catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, 'categoryRef'),
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
  const [candidateResolved, setCandidateResolved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!field || !source) {
      setTreeData([]);
      setError('分类信息暂不可用，请稍后重试。');
      setCandidateResolved(true);
      return () => {
        cancelled = true;
      };
    }
    if (!scopeRef) {
      setTreeData([]);
      setError('请先选择可查看范围，再加载分类。');
      setCandidateResolved(true);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(undefined);
    setCandidateResolved(false);
    void resolver(source, context)
      .then(result => {
        if (cancelled || result.stale) return;
        setTreeData(result.treeData);
        setCandidateResolved(true);
      })
      .catch(() => {
        if (!cancelled) {
          setTreeData([]);
          setError('分类候选加载失败，请重试。');
          setCandidateResolved(true);
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
  const presentationField = {
    ...renderedField,
    label: '分类',
    helpText: '选择商品所属分类，也可以暂不分类。',
  };
  const candidateResolutionPending = !error && !candidateResolved;
  return (
    <div {...testId('catalog-item-category-field')}>
      {candidateResolutionPending ? (
        <Space orientation="vertical" size={4} style={{display: 'flex'}}>
          <Typography.Text strong>{presentationField.label}</Typography.Text>
          <Typography.Text type="secondary">分类候选加载中…</Typography.Text>
          <Typography.Text type="secondary" style={{fontSize: 12}}>
            {presentationField.helpText}
          </Typography.Text>
        </Space>
      ) : (
        <DescriptorFieldRenderer
          field={presentationField}
          value={value ?? ''}
          treeData={treeData}
          optionLoading={loading}
          optionError={error}
          onChange={next => {
            onChange(typeof next === 'string' && next ? next : undefined);
            onDirty();
          }}
        />
      )}
    </div>
  );
}

export function IdentifierEditor({
  values,
  allowedTypes,
  heading = '条码与标识',
  description = '识别码用于扫码、称重键码或快速检索。商品编码无需在此重复维护。',
  createDraftRowId,
  onChange,
  onDirty,
}: {
  values: CatalogIdentifierDraft[];
  allowedTypes: CatalogIdentifierType[];
  heading?: string;
  description?: string;
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogIdentifierDraft[]) => void;
  onDirty: () => void;
}) {
  const update = (index: number, patch: Partial<CatalogIdentifierDraft>) =>
    onChange(values.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-identifiers-editor')}>
      <Typography.Title level={5} style={{margin: 0}}>
        {heading}
      </Typography.Title>
      <Typography.Text type="secondary">
        {description}
      </Typography.Text>
      <Button
        onClick={() => {
          const identifierType = allowedTypes[0] ?? 'MNEMONIC';
          onChange([
            ...values,
            {
              editorId: createDraftRowId('identifier'),
              identifierRef: draftUuid(),
              ownerType: 'CATALOG_ITEM',
              ownerRef: draftUuid(),
              identifierType,
              identifierValue: '',
              normalizedValue: '',
              displayOrder: values.length,
            },
          ]);
          onDirty();
        }}
        disabled={allowedTypes.length === 0}
        {...testId('catalog-item-identifier-add')}
      >
        添加识别码
      </Button>
      {allowedTypes.length === 0 && <EmptySection text="当前商品类型不提供识别方式" />}
      {values.length === 0 && allowedTypes.length > 0 && <EmptySection text="尚未维护识别码" />}
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
            <Select
              aria-label={`识别码 ${index + 1} 类型`}
              value={entry.identifierType}
              optionLabelProp="label"
              options={allowedTypes.map(identifierType => ({
                value: identifierType,
                label: CATALOG_IDENTIFIER_TYPE_LABELS[identifierType],
              }))}
              onChange={identifierType => {
                update(index, {identifierType});
                onDirty();
              }}
              {...testId(`catalog-item-identifier-type-${index}`)}
            />
            <Input
              aria-label={`识别码 ${index + 1} 识别值`}
              placeholder="请输入识别值"
              maxLength={160}
              value={entry.identifierValue}
              onChange={event => {
                update(index, {identifierValue: event.target.value});
                onDirty();
              }}
              {...testId(`catalog-item-identifier-value-${index}`)}
            />
            {entry.identifierType === 'MNEMONIC' && (
              <Typography.Text type="secondary">助记码不区分大小写</Typography.Text>
            )}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

export function SkuIdentifierEditorModal({
  open,
  sku,
  allowedTypes,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  sku?: CatalogSkuRow;
  allowedTypes: CatalogIdentifierType[];
  onCancel: () => void;
  onConfirm: (identifiers: CatalogIdentifier[]) => void;
}) {
  const [draft, setDraft] = useState<CatalogIdentifierDraft[]>([]);
  const [problem, setProblem] = useState<string>();
  const sequence = useRef(0);
  const createDraftRowId = useCallback((prefix: string) => {
    sequence.current += 1;
    return `${prefix}-${sequence.current}`;
  }, []);
  useEffect(() => {
    if (!open || !sku) return;
    setDraft(sku.identifiers.map(identifier => ({...identifier, editorId: createDraftRowId('sku-identifier')})));
    setProblem(undefined);
  }, [createDraftRowId, open, sku]);
  return (
    <Modal
      open={open}
      title={sku ? `维护识别码 · ${sku.skuName || sku.skuCode}` : '维护识别码'}
      onCancel={onCancel}
      onOk={() => {
        const invalid = draft.some(identifier => !identifier.identifierValue.trim());
        if (invalid) {
          setProblem('请填写识别值');
          return;
        }
        onConfirm(draft.map(({editorId: _editorId, ...identifier}) => identifier));
      }}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      {...testId('catalog-sku-identifier-modal')}
    >
      <Space direction="vertical" style={{display: 'flex'}} size={12}>
        {problem && <Alert type="error" showIcon title={problem} role="alert" />}
        <IdentifierEditor
          values={draft}
          allowedTypes={allowedTypes}
          heading="规格识别码"
          description="这些识别码只识别当前规格。返回商品页面后仍需点击保存才会生效。"
          createDraftRowId={createDraftRowId}
          onChange={setDraft}
          onDirty={() => setProblem(undefined)}
        />
      </Space>
    </Modal>
  );
}

function emptyPreparationProfile(): PreparationProfileDraft {
  return {
    productionTagRefs: [],
    productionDisplayName: null,
    estimatedPreparationSeconds: null,
    preparationNotes: null,
  };
}

export function SkuPreparationEditorModal({
  open,
  sku,
  itemDefaultPreparation,
  availableProductionTags,
  selectedProductionTags,
  productionTagsLoading,
  onProductionTagsSearch,
  onProductionTagsPopupScroll,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  sku?: CatalogSkuRow;
  itemDefaultPreparation: PreparationProfileDraft | null;
  availableProductionTags: ProductionTagOption[];
  selectedProductionTags: ProductionTagOption[];
  productionTagsLoading: boolean;
  onProductionTagsSearch: (value: string) => void;
  onProductionTagsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
  onCancel: () => void;
  onConfirm: (value: CatalogSkuRow['preparationOverride']) => void;
}) {
  const [mode, setMode] = useState<'INHERIT_ITEM' | 'OVERRIDE'>('INHERIT_ITEM');
  const [profile, setProfile] = useState<PreparationProfileDraft>(emptyPreparationProfile);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    if (!open || !sku) return;
    setMode(sku.preparationOverride.mode);
    setProfile(clonePreparationProfile(sku.preparationOverride.profile) ?? emptyPreparationProfile());
    setProblem(undefined);
  }, [open, sku]);
  const knownTags = Array.from(
    new Map(
      [...selectedProductionTags, ...availableProductionTags].map(tag => [tag.tagRef, tag]),
    ).values(),
  );
  const selectedTagRefs = profile.productionTagRefs.map(String);
  const tagOptions = Array.from(new Set([...selectedTagRefs, ...knownTags.map(tag => tag.tagRef)])).map(tagRef => {
    const tag = knownTags.find(candidate => candidate.tagRef === tagRef);
    return {
      value: tagRef,
      label: tag?.name || tag?.code || '已维护的制作处理标签',
      disabled: tag?.status !== undefined && tag.status !== 'ENABLED',
    };
  });
  const inheritedPreview = itemDefaultPreparation ? (
    <PreparationProfileReadOnly
      profile={itemDefaultPreparation}
      tags={itemDefaultPreparation.productionTagRefs.map(ref => knownTags.find(tag => tag.tagRef === ref)).filter(Boolean) as ProductionTagOption[]}
    />
  ) : (
    <EmptySection text="当前商品尚未设置默认制作信息" />
  );
  return (
    <Modal
      open={open}
      title={sku ? `维护制作信息 · ${sku.skuName || sku.skuCode}` : '维护制作信息'}
      onCancel={onCancel}
      onOk={() => {
        if (mode === 'INHERIT_ITEM') {
          onConfirm(skuPreparationOverrideForMode('INHERIT_ITEM', null));
          return;
        }
        if (profile.estimatedPreparationSeconds !== null && profile.estimatedPreparationSeconds < 0) {
          setProblem('预计制作时长请填写零或正整数。');
          return;
        }
        onConfirm(skuPreparationOverrideForMode('OVERRIDE', profile));
      }}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      {...testId('catalog-sku-preparation-modal')}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {problem && <Alert type="error" showIcon title={problem} role="alert" />}
        <Radio.Group
          value={mode}
          onChange={event => {
            setMode(event.target.value);
            setProblem(undefined);
          }}
          options={[
            {label: '使用商品默认', value: 'INHERIT_ITEM'},
            {label: '单独设置', value: 'OVERRIDE'},
          ]}
          {...testId('catalog-sku-preparation-mode')}
        />
        {mode === 'INHERIT_ITEM' ? (
          <>
            <Typography.Text type="secondary">使用商品默认时，会随商品的默认制作信息一起变化。</Typography.Text>
            <Card size="small" title="当前商品默认">{inheritedPreview}</Card>
          </>
        ) : (
          <>
            <Typography.Text type="secondary">单独设置时，将使用本规格自己的一整套制作信息。</Typography.Text>
            <PreparationProfileEditor
              profile={profile}
              selectedTagRefs={selectedTagRefs}
              selectedTags={knownTags.filter(tag => selectedTagRefs.includes(tag.tagRef))}
              tagOptions={tagOptions}
              tagsLoading={productionTagsLoading}
              onTagsSearch={onProductionTagsSearch}
              onTagsPopupScroll={onProductionTagsPopupScroll}
              heading="本规格制作信息"
              description="本规格的制作信息不会随商品默认自动变化。"
              onTagsChange={next => setProfile(current => ({...current, productionTagRefs: next as PreparationProfileDraft['productionTagRefs']}))}
              onChange={next => setProfile(next ?? emptyPreparationProfile())}
              onDirty={() => setProblem(undefined)}
            />
            <Button
              type="link"
              onClick={() => {
                setMode('INHERIT_ITEM');
                setProfile(emptyPreparationProfile());
              }}
              {...testId('catalog-sku-preparation-clear')}
            >
              清除单独设置并恢复商品默认
            </Button>
          </>
        )}
        <Typography.Text type="secondary">返回商品页面后仍需点击保存才会生效。</Typography.Text>
      </Space>
    </Modal>
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
  allowedIdentifierTypes,
  itemDefaultPreparation,
  availableProductionTags,
  selectedProductionTags,
  productionTagsLoading,
  onProductionTagsSearch,
  onProductionTagsPopupScroll,
  priceGranularity,
  skuStagedMedia,
  scopeRef,
  brandRef,
  version,
  unitOptions,
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
  allowedIdentifierTypes: CatalogIdentifierType[];
  itemDefaultPreparation: PreparationProfileDraft | null;
  availableProductionTags: ProductionTagOption[];
  selectedProductionTags: ProductionTagOption[];
  productionTagsLoading: boolean;
  onProductionTagsSearch: (value: string) => void;
  onProductionTagsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
  priceGranularity: string;
  skuStagedMedia: MediaDraft[];
  scopeRef?: string;
  brandRef?: string;
  version: number;
  unitOptions: CatalogUnitOption[];
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
  const [identifierModalIndex, setIdentifierModalIndex] = useState<number>();
  const [preparationModalIndex, setPreparationModalIndex] = useState<number>();
  const fieldLabel = (fieldKey: string) => catalogFieldLabel(manifest, fieldKey);
  const mediaLimits = decodeCatalogMediaLimits(manifest);
  const unitSelectOptions = (current?: {unitRef: CatalogUnitOption['unitRef']; code: string; name: string}) => {
    const options = new Map(unitOptions.map(unit => [unit.unitRef, unit]));
    if (current && !options.has(current.unitRef))
      options.set(current.unitRef, {
        ...current,
        unitDimension: 'COUNT' as const,
        precision: 0,
        status: 'DISABLED' as const,
        isReferenced: false,
        version: 0,
      });
    return [...options.values()].map(unit => ({value: unit.unitRef, label: catalogUnitLabel(unit)}));
  };
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
                  <Button
                    onClick={() => setIdentifierModalIndex(skuIndex)}
                    {...testId(`catalog-item-sku-identifiers-${skuIndex}`)}
                  >
                    维护识别码（{sku.identifiers.length ? `${sku.identifiers.length} 个` : '未维护'}）
                  </Button>
                  <Button
                    onClick={() => setPreparationModalIndex(skuIndex)}
                    {...testId(`catalog-item-sku-preparation-${skuIndex}`)}
                  >
                    维护制作信息（{sku.preparationOverride.mode === 'OVERRIDE' ? '已单独设置' : '使用商品默认'}）
                  </Button>
                  <SkuFieldFeedback message={issue('MISSING_SKU_PRICE')}>
                    <InputNumber
                      prefix="标准价（元）"
                      min={0}
                      precision={2}
                      step={0.01}
                      status={issue('MISSING_SKU_PRICE') ? 'error' : undefined}
                      value={catalogCentsToYuan(sku.standardSalePrice)}
                      onChange={standardSalePrice => {
                        updateSku(skuIndex, {standardSalePrice: catalogYuanToCents(standardSalePrice)});
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
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="继承商品销售单位"
                    value={sku.salesUnitOverrideRef ?? undefined}
                    options={unitSelectOptions(sku.salesUnit ?? undefined)}
                    onChange={salesUnitOverrideRef => {
                      updateSku(skuIndex, {salesUnitOverrideRef: salesUnitOverrideRef ?? null});
                      onDirty();
                    }}
                    {...testId(`catalog-item-sku-sales-unit-override-${skuIndex}`)}
                  />
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="继承商品基础计量单位"
                    value={sku.baseMeasureUnitOverrideRef ?? undefined}
                    options={unitSelectOptions(sku.baseMeasureUnit ?? undefined)}
                    onChange={baseMeasureUnitOverrideRef => {
                      updateSku(skuIndex, {baseMeasureUnitOverrideRef: baseMeasureUnitOverrideRef ?? null});
                      onDirty();
                    }}
                    {...testId(`catalog-item-sku-base-measure-unit-override-${skuIndex}`)}
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
                    {sku.mediaRefs.map((assetRef, mediaIndex) => {
                      const stagedAsset = skuStagedMedia.find(
                        asset => asset.skuIndex === skuIndex && asset.assetRef === assetRef && asset.staged,
                      );
                      return (
                        <Space direction="vertical" size={2} key={assetRef}>
                          <CatalogAssetPreview
                            assetRef={assetRef}
                            localFile={stagedAsset?.file}
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
                      );
                    })}
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
                          {asset.file ? (
                            <CatalogAssetPreview
                              localFile={asset.file}
                              alt={`${sku.skuName || sku.skuCode || `SKU ${skuIndex + 1}`}待上传图片`}
                              width={96}
                              height={72}
                              testId={`catalog-item-sku-media-draft-preview-${skuIndex}-${asset.id}`}
                            />
                          ) : (
                            <span style={{width: 96, height: 72, display: 'grid', placeItems: 'center'}}>
                              <Typography.Text type="secondary">
                                {asset.status === 'UPLOADING' ? '上传中/处理中' : '上传失败'}
                              </Typography.Text>
                            </span>
                          )}
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
      <SkuIdentifierEditorModal
        open={identifierModalIndex !== undefined}
        sku={identifierModalIndex === undefined ? undefined : skus[identifierModalIndex]}
        allowedTypes={allowedIdentifierTypes}
        onCancel={() => setIdentifierModalIndex(undefined)}
        onConfirm={identifiers => {
          if (identifierModalIndex === undefined) return;
          updateSku(identifierModalIndex, {identifiers});
          onDirty();
          setIdentifierModalIndex(undefined);
        }}
      />
      <SkuPreparationEditorModal
        open={preparationModalIndex !== undefined}
        sku={preparationModalIndex === undefined ? undefined : skus[preparationModalIndex]}
        itemDefaultPreparation={itemDefaultPreparation}
        availableProductionTags={availableProductionTags}
        selectedProductionTags={selectedProductionTags}
        productionTagsLoading={productionTagsLoading}
        onProductionTagsSearch={onProductionTagsSearch}
        onProductionTagsPopupScroll={onProductionTagsPopupScroll}
        onCancel={() => setPreparationModalIndex(undefined)}
        onConfirm={preparationOverride => {
          if (preparationModalIndex === undefined) return;
          updateSku(preparationModalIndex, {preparationOverride});
          onDirty();
          setPreparationModalIndex(undefined);
        }}
      />
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
                      {
                        key: 'identifiers',
                        label: '识别码',
                        children: sku.identifiers.length
                          ? sku.identifiers
                              .map(identifier => CATALOG_IDENTIFIER_TYPE_LABELS[identifier.identifierType])
                              .join('、')
                          : '未维护',
                      },
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

export function PreparationProfileEditor({
  profile,
  selectedTagRefs,
  selectedTags,
  tagOptions,
  tagsLoading,
  heading = '商品默认制作信息',
  description = '这些信息会作为商品通常采用的制作内容。',
  onTagsSearch,
  onTagsPopupScroll,
  onTagsChange,
  onChange,
  onDirty,
}: {
  profile: PreparationProfileDraft | null;
  selectedTagRefs: string[];
  selectedTags: ProductionTagOption[];
  tagOptions: Array<{label: string; value: string; disabled?: boolean}>;
  tagsLoading: boolean;
  heading?: string;
  description?: string;
  onTagsSearch: (value: string) => void;
  onTagsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
  onTagsChange: (next: string[]) => void;
  onChange: (next: PreparationProfileDraft | null) => void;
  onDirty: () => void;
}) {
  const current: PreparationProfileDraft = profile ?? {
    productionTagRefs: selectedTagRefs as PreparationProfileDraft['productionTagRefs'],
    productionDisplayName: null,
    estimatedPreparationSeconds: null,
    preparationNotes: null,
  };
  const update = (patch: Partial<PreparationProfileDraft>) => {
    onChange({...current, ...patch});
    onDirty();
  };
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId('catalog-item-preparation-editor')}
    >
      <Typography.Title level={5} style={{margin: 0}}>
        {heading}
      </Typography.Title>
      <Typography.Text type="secondary">{description}</Typography.Text>
      <div>
        <Typography.Text strong>制作处理标签</Typography.Text>
        <Select
          mode="multiple"
          value={selectedTagRefs}
          options={tagOptions}
          loading={tagsLoading}
          showSearch
          filterOption={false}
          placeholder="选择已有制作处理标签"
          onSearch={onTagsSearch}
          onChange={onTagsChange}
          onPopupScroll={onTagsPopupScroll}
          style={{width: '100%', marginTop: 6}}
          {...testId('catalog-item-production-tags')}
        />
        {selectedTags.some(tag => tag.status === 'DISABLED') && (
          <Typography.Text type="warning" style={{display: 'block', marginTop: 4}}>
            已停用的标签会保留在当前设置中，但不能用于新选择。
          </Typography.Text>
        )}
      </div>
      <Input
        addonBefore="制作单显示名称"
        maxLength={120}
        showCount
        value={current.productionDisplayName ?? ''}
        placeholder="例如：大杯热拿铁"
        onChange={event => update({productionDisplayName: event.target.value || null})}
        {...testId('catalog-item-production-name')}
      />
      <InputNumber
        addonBefore="预计制作时长（秒）"
        min={0}
        precision={0}
        value={current.estimatedPreparationSeconds ?? undefined}
        placeholder="填写零或正整数"
        onChange={value => update({estimatedPreparationSeconds: value ?? null})}
        {...testId('catalog-item-production-seconds')}
      />
      <Input.TextArea
        autoSize={{minRows: 3, maxRows: 8}}
        maxLength={1000}
        showCount
        value={current.preparationNotes ?? ''}
        placeholder="留空表示未维护"
        onChange={event => update({preparationNotes: event.target.value || null})}
        {...testId('catalog-item-production-notes')}
      />
    </Space>
  );
}

function PreparationProfileReadOnly({
  profile,
  tags,
}: {
  profile: PreparationProfileDraft | null;
  tags: ProductionTagOption[];
}) {
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId('catalog-item-preparation-readonly')}
    >
      {!profile ? (
        <EmptySection text="尚未设置制作信息" />
      ) : (
        <Descriptions
          size="small"
          column={2}
          items={[
            {
              key: 'tags',
              label: '制作处理标签',
              children: tags.length ? (
                <Space wrap>{tags.map(tag => <Tag key={tag.tagRef}>{tag.name || tag.code}</Tag>)}</Space>
              ) : (
                '—'
              ),
            },
            {key: 'name', label: '制作单显示名称', children: profile.productionDisplayName || '—'},
            {
              key: 'seconds',
              label: '预计制作时长（秒）',
              children: profile.estimatedPreparationSeconds ?? '—',
            },
            {key: 'notes', label: '制作说明', children: profile.preparationNotes || '—'},
          ]}
        />
      )}
    </Space>
  );
}

export function PreparationVariationSummary({
  skus,
  orderOptions,
  shapeKey,
  onNavigateToOptions,
}: {
  skus: CatalogSkuRow[];
  orderOptions: CatalogOrderOptionConfig[];
  shapeKey: string;
  onNavigateToOptions: () => void;
}) {
  const optionEffectCount = orderOptions.reduce(
    (count, option) => count + option.values.filter(value => value.preparationEffect !== null).length,
    0,
  );
  const layout = catalogPreparationLayout(
    shapeKey,
    skus.some(sku => sku.preparationOverride.mode === 'OVERRIDE') ? skus.length : 0,
    optionEffectCount,
  );
  if (layout === 'ITEM_ONLY') return null;
  return (
    <Card
      size="small"
      title="各规格与点单选项的制作变化"
      {...testId('catalog-preparation-variation-summary')}
      data-preparation-layout={layout}
    >
      {(layout === 'SKU' || layout === 'SKU_AND_OPTIONS') && <Typography.Text>已有规格单独设置制作信息。</Typography.Text>}
      {(layout === 'OPTIONS' || layout === 'SKU_AND_OPTIONS') && (
        <Button type="link" onClick={onNavigateToOptions} {...testId('catalog-item-option-preparation-link')}>
          {optionEffectCount} 个点单选项已设置制作变化，去点单选项维护
        </Button>
      )}
    </Card>
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
  const candidateState = useCursorCandidates<ReturnType<typeof decodeItems>['items'][number]>({
    queryText: keyword,
    resetKey: `${open}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${categoryRef ?? ''}`,
    pageSize: 20,
    keyOf: item => item.itemRef,
  });
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
            ...(candidateState.debouncedQueryText ? {keyword: candidateState.debouncedQueryText} : {}),
            ...(categoryRef ? {categoryRef: wireUuid(categoryRef), includeSubCategories: true} : {}),
            ...(candidateState.cursor ? {cursor: candidateState.cursor} : {}),
            pageSize: candidateState.pageSize,
          },
          headers,
        },
      ),
    [
      candidateState.cursor,
      candidateState.debouncedQueryText,
      candidateState.pageSize,
      categoryRef,
      headers,
      queryContext.scopeRef,
    ],
  );
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !open});
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemRequest, {skip: !open});
  const navigation = decodeNavigation(navigationQuery.data);
  const page = decodeItems(itemsQuery.currentData);
  const acceptCandidatePage = candidateState.acceptPage;
  const candidatePageSize = candidateState.pageSize;
  useEffect(() => {
    if (!itemsQuery.currentData) return;
    acceptCandidatePage(page.items, {
      pageSize: candidatePageSize,
      total: page.total,
      nextCursor: page.cursor,
    });
  }, [acceptCandidatePage, candidatePageSize, itemsQuery.currentData, page.cursor, page.items, page.total]);
  const treeData = useMemo(() => buildCategoryTree(navigation.tree), [navigation.tree]);
  useEffect(() => {
    if (!open) {
      setKeyword('');
      setCategoryRef(undefined);
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
        maskClosable
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
                }}
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
                loading={itemsQuery.isLoading || (itemsQuery.isFetching && !candidateState.items.length)}
                dataSource={candidateState.items.filter(item => item.code !== currentItemCode)}
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
              {candidateState.nextCursor && (
                <Button
                  onClick={() => candidateState.loadNext(itemsQuery.isFetching)}
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
                  prefix="加价（元）"
                  value={catalogCentsToYuan(component.extraPrice)}
                  min={0}
                  precision={2}
                  step={0.01}
                  onChange={extraPrice => {
                    updateComponent(groupIndex, componentIndex, {extraPrice: catalogYuanToCents(extraPrice)});
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
            {asset.assetRef || (asset.staged && asset.file) ? (
              <CatalogAssetPreview
                assetRef={asset.assetRef}
                localFile={asset.staged ? asset.file : undefined}
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
                    : asset.staged
                      ? '待保存'
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
function AttributeAssignmentsEditor({
  values,
  onChange,
  onDirty,
  scopeRef,
  brandRef,
}: {
  values: CatalogAttributeAssignment[];
  onChange: (next: CatalogAttributeAssignment[]) => void;
  onDirty: () => void;
  scopeRef?: string;
  brandRef?: string;
}) {
  const commit = (next: CatalogAttributeAssignment[]) => {
    onChange(next);
    onDirty();
  };
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefinitionRefs, setPendingDefinitionRefs] = useState<string[]>([]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogAttributeDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const query = operationsRtk.useListOperationsCatalogAttributeDefinitionsQuery(request, {skip: !scopeRef});
  const definitions = query.currentData?.data.definitions ?? [];
  const availableDefinitions = definitions.filter(
    definition => !values.some(value => value.definitionRef === definition.definitionRef),
  );
  const openAdd = () => {
    setPendingDefinitionRefs([]);
    setAddOpen(true);
  };
  const addDefinitions = () => {
    const selected = new Set(pendingDefinitionRefs);
    const additions = definitions
      .filter(
        definition =>
          selected.has(definition.definitionRef) &&
          !values.some(value => value.definitionRef === definition.definitionRef),
      )
      .map(definition => ({
        definitionRef: definition.definitionRef,
        code: definition.code,
        name: definition.name,
        valueType: definition.valueType,
        textValue: null,
        optionRefs: [],
      }));
    if (additions.length) commit([...values, ...additions]);
    setAddOpen(false);
  };
  const moveAssignment = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  return (
    <Space direction="vertical" style={{display: 'flex'}}>
      <Button
        type="primary"
        onClick={openAdd}
        disabled={!availableDefinitions.length}
        loading={query.isFetching}
        {...testId('catalog-item-attribute-library-add')}
      >
        添加商品属性
      </Button>
      <Modal
        title="添加商品属性"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={addDefinitions}
        maskClosable
        okText="添加"
        cancelText="取消"
        destroyOnHidden
        {...testId('catalog-item-attribute-library-add-modal')}
      >
        {availableDefinitions.length ? (
          <Checkbox.Group
            value={pendingDefinitionRefs}
            onChange={refs => setPendingDefinitionRefs(refs.map(String))}
            style={{display: 'flex', flexDirection: 'column', gap: 12}}
            options={availableDefinitions.map(definition => ({
              label: <NameCodeText name={definition.name} code={definition.code} />,
              value: definition.definitionRef,
            }))}
          />
        ) : (
          <EmptySection text="没有可添加的商品属性。" />
        )}
      </Modal>
      {values.length === 0 ? (
        <EmptySection text="请先从商品属性库添加属性。" />
      ) : (
        values.map((assignment, index) => {
          const definition = definitions.find(entry => entry.definitionRef === assignment.definitionRef);
          return (
            <Card
              key={assignment.definitionRef}
              size="small"
              title={assignment.name}
              extra={
                <Space>
                  <Tag>
                    {assignment.valueType === 'TEXT'
                      ? '纯文本'
                      : assignment.valueType === 'SINGLE_SELECT'
                        ? '单选'
                        : '多选'}
                  </Tag>
                  <Button type="link" disabled={index === 0} onClick={() => moveAssignment(index, -1)}>
                    上移
                  </Button>
                  <Button type="link" disabled={index === values.length - 1} onClick={() => moveAssignment(index, 1)}>
                    下移
                  </Button>
                  <Button type="link" danger onClick={() => commit(values.filter((_, rowIndex) => rowIndex !== index))}>
                    移除
                  </Button>
                </Space>
              }
            >
              {assignment.valueType === 'TEXT' ? (
                <Input
                  value={assignment.textValue ?? ''}
                  onChange={event =>
                    commit(
                      values.map((row, rowIndex) =>
                        rowIndex === index ? {...row, textValue: event.target.value} : row,
                      ),
                    )
                  }
                  placeholder="填写属性值"
                />
              ) : (
                <Select
                  mode={assignment.valueType === 'MULTI_SELECT' ? 'multiple' : undefined}
                  value={assignment.optionRefs}
                  options={(definition?.options ?? []).map(option => ({value: option.optionRef, label: option.name}))}
                  onChange={optionRefs =>
                    commit(
                      values.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              optionRefs: Array.isArray(optionRefs) ? optionRefs : optionRefs ? [optionRefs] : [],
                            }
                          : row,
                      ),
                    )
                  }
                  placeholder="选择属性值"
                />
              )}
            </Card>
          );
        })
      )}
    </Space>
  );
}
function AttributeAssignmentsReadOnly({values}: {values: CatalogAttributeAssignment[]}) {
  return values.length ? (
    <Descriptions
      {...adminWideDetailDescriptionsProps}
      items={values.map(value => ({
        key: value.definitionRef,
        label: value.name,
        children: value.valueType === 'TEXT' ? value.textValue || '—' : `已选择 ${value.optionRefs.length} 项`,
      }))}
    />
  ) : (
    <EmptySection text="未维护商品属性" />
  );
}
function OrderOptionConfigurationsEditor({
  values,
  onChange,
  onDirty,
  scopeRef,
  brandRef,
  availableProductionTags,
  selectedProductionTags,
  productionTagsLoading,
  onProductionTagsSearch,
  onProductionTagsPopupScroll,
}: {
  values: CatalogOrderOptionConfig[];
  onChange: (next: CatalogOrderOptionConfig[]) => void;
  onDirty: () => void;
  scopeRef?: string;
  brandRef?: string;
  availableProductionTags: ProductionTagOption[];
  selectedProductionTags: ProductionTagOption[];
  productionTagsLoading: boolean;
  onProductionTagsSearch: (value: string) => void;
  onProductionTagsPopupScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const normalizeDisplayOrders = (next: CatalogOrderOptionConfig[]) =>
    next.map((config, configIndex) => ({
      ...config,
      displayOrder: configIndex,
      values: config.values.map(value => ({
        ...value,
        preparationEffect: value.preparationEffect
          ? {
              ...value.preparationEffect,
              definitionValueRef: value.definitionValueRef,
              optionGroupDisplayOrder: configIndex,
              optionValueDisplayOrder: value.displayOrder,
            }
          : null,
      })),
    }));
  const commit = (next: CatalogOrderOptionConfig[]) => {
    onChange(normalizeDisplayOrders(next));
    onDirty();
  };
  const [selectedDefinitionRef, setSelectedDefinitionRef] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefinitionRefs, setPendingDefinitionRefs] = useState<string[]>([]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogOrderOptionDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const query = operationsRtk.useListOperationsCatalogOrderOptionDefinitionsQuery(request, {skip: !scopeRef});
  const definitions = query.currentData?.data.definitions ?? [];
  const availableDefinitions = definitions.filter(
    definition => !values.some(value => value.definitionRef === definition.definitionRef),
  );
  const activeDefinitionRef = values.some(config => config.definitionRef === selectedDefinitionRef)
    ? selectedDefinitionRef
    : values[0]?.definitionRef;
  const activeConfig = values.find(config => config.definitionRef === activeDefinitionRef);
  const openAdd = () => {
    setPendingDefinitionRefs([]);
    setAddOpen(true);
  };
  const buildConfig = (definition: (typeof definitions)[number]): CatalogOrderOptionConfig => ({
    definitionRef: definition.definitionRef,
    name: definition.name,
    selectionMode: definition.selectionMode,
    displayOrder: values.length,
    required: false,
    minSelectionCount: definition.selectionMode === 'MULTIPLE' ? 0 : null,
    maxSelectionCount: definition.selectionMode === 'MULTIPLE' ? null : null,
    values: definition.values.map(value => ({
      definitionValueRef: value.valueRef,
      name: value.name,
      displayOrder: value.displayOrder,
      defaultValue: false,
      extraPrice: null,
      bomVersion: definition.version,
      preparationEffect: null,
    })),
  });
  const addDefinitions = () => {
    const selected = new Set(pendingDefinitionRefs);
    const additions = definitions
      .filter(
        definition =>
          selected.has(definition.definitionRef) &&
          !values.some(value => value.definitionRef === definition.definitionRef),
      )
      .map(buildConfig);
    if (additions.length) {
      commit([...values, ...additions]);
      setSelectedDefinitionRef(additions[0].definitionRef);
    }
    setAddOpen(false);
  };
  const moveConfig = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const removeConfig = (definitionRef: string) => {
    const removedIndex = values.findIndex(config => config.definitionRef === definitionRef);
    const next = values.filter(config => config.definitionRef !== definitionRef);
    if (activeDefinitionRef === definitionRef) {
      setSelectedDefinitionRef(next[Math.min(removedIndex, next.length - 1)]?.definitionRef);
    }
    commit(next);
  };
  const updateActive = (patch: Partial<CatalogOrderOptionConfig>) =>
    commit(
      values.map(config => (config.definitionRef === activeConfig?.definitionRef ? {...config, ...patch} : config)),
    );
  const updateValue = (valueRef: string, patch: Partial<CatalogOrderOptionConfig['values'][number]>) =>
    updateActive({
      values: (activeConfig?.values ?? []).map(value =>
        value.definitionValueRef === valueRef ? {...value, ...patch} : value,
      ),
    });
  const knownProductionTags = Array.from(
    new Map(
      [...selectedProductionTags, ...availableProductionTags].map(tag => [tag.tagRef, tag]),
    ).values(),
  );
  const productionTagOptions = (refs: string[]) =>
    Array.from(new Set([...refs, ...knownProductionTags.map(tag => tag.tagRef)])).map(tagRef => {
      const tag = knownProductionTags.find(candidate => candidate.tagRef === tagRef);
      return {
        value: tagRef,
        label: tag?.name || tag?.code || '已维护的制作处理标签',
        disabled: tag?.status !== undefined && tag.status !== 'ENABLED',
      };
    });
  return (
    <Space direction="vertical" style={{display: 'flex'}} size="middle">
      <Button
        type="primary"
        onClick={openAdd}
        disabled={!availableDefinitions.length}
        loading={query.isFetching}
        {...testId('catalog-item-order-option-library-add')}
      >
        添加点单选项
      </Button>
      <Modal
        title="添加点单选项"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={addDefinitions}
        maskClosable
        okText="添加"
        cancelText="取消"
        destroyOnHidden
        {...testId('catalog-item-order-option-library-add-modal')}
      >
        {availableDefinitions.length ? (
          <Checkbox.Group
            value={pendingDefinitionRefs}
            onChange={refs => setPendingDefinitionRefs(refs.map(String))}
            style={{display: 'flex', flexDirection: 'column', gap: 12}}
            options={availableDefinitions.map(definition => ({
              label: <NameCodeText name={definition.name} code={definition.code} />,
              value: definition.definitionRef,
            }))}
          />
        ) : (
          <EmptySection text="没有可添加的点单选项。" />
        )}
      </Modal>
      {values.length === 0 ? (
        <EmptySection text="请先从点单选项库添加点单选项。" />
      ) : (
        <Row gutter={[12, 12]} align="top">
          <Col xs={24} lg={7}>
            <Card size="small" title="已添加的点单选项">
              <ProList<CatalogOrderOptionConfig>
                rowKey="definitionRef"
                dataSource={values}
                cardProps={false}
                search={false}
                toolBarRender={false}
                pagination={false}
                split
                onItem={config => ({onClick: () => setSelectedDefinitionRef(config.definitionRef)})}
                metas={{
                  title: {
                    dataIndex: 'name',
                    render: (_, config) => (
                      <Button
                        type={config.definitionRef === activeDefinitionRef ? 'link' : 'text'}
                        style={{paddingInline: 0}}
                      >
                        {config.name}
                      </Button>
                    ),
                  },
                  actions: {
                    dataIndex: 'definitionRef',
                    render: (_, config, index) => (
                      <Space size={0}>
                        <Button
                          type="link"
                          disabled={index === 0}
                          onClick={event => {
                            event.stopPropagation();
                            moveConfig(index, -1);
                          }}
                        >
                          上移
                        </Button>
                        <Button
                          type="link"
                          disabled={index === values.length - 1}
                          onClick={event => {
                            event.stopPropagation();
                            moveConfig(index, 1);
                          }}
                        >
                          下移
                        </Button>
                        <Button
                          type="link"
                          danger
                          onClick={event => {
                            event.stopPropagation();
                            removeConfig(config.definitionRef);
                          }}
                        >
                          移除
                        </Button>
                      </Space>
                    ),
                  },
                }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title="本商品设置">
              {activeConfig && (
                <Space direction="vertical" style={{display: 'flex'}} size="middle">
                  <Space wrap>
                    <Typography.Text strong>{activeConfig.name}</Typography.Text>
                    <Tag>
                      {activeConfig.selectionMode === 'SINGLE'
                        ? '单选'
                        : `多选${activeConfig.maxSelectionCount === 1 ? '（最多 1 项）' : ''}`}
                    </Tag>
                    <Switch
                      checked={activeConfig.required}
                      checkedChildren="必选"
                      unCheckedChildren="可不选"
                      onChange={required => updateActive({required})}
                    />
                  </Space>
                  {activeConfig.selectionMode === 'MULTIPLE' && (
                    <Space wrap>
                      <Typography.Text>最少可选</Typography.Text>
                      <InputNumber
                        min={0}
                        value={activeConfig.minSelectionCount}
                        onChange={minSelectionCount => updateActive({minSelectionCount})}
                      />
                      <Typography.Text>最多可选</Typography.Text>
                      <InputNumber
                        min={1}
                        value={activeConfig.maxSelectionCount}
                        onChange={maxSelectionCount => updateActive({maxSelectionCount})}
                      />
                    </Space>
                  )}
                  <Divider style={{margin: 0}} />
                  {activeConfig.values.map(value => (
                    <Card key={value.definitionValueRef} size="small" title={value.name}>
                      <Space direction="vertical" style={{display: 'flex'}} size="small">
                        <Space wrap>
                          <Switch
                            checked={value.defaultValue}
                            checkedChildren="默认"
                            unCheckedChildren="非默认"
                            onChange={defaultValue => updateValue(value.definitionValueRef, {defaultValue})}
                          />
                          <Typography.Text>加价（元）</Typography.Text>
                          <InputNumber
                            min={0}
                            precision={2}
                            prefix="¥"
                            value={catalogCentsToYuan(value.extraPrice)}
                            onChange={extraPrice =>
                              updateValue(value.definitionValueRef, {extraPrice: catalogYuanToCents(extraPrice)})
                            }
                          />
                        </Space>
                        <Divider style={{margin: '4px 0'}} />
                        <Typography.Text strong>制作变化（可选）</Typography.Text>
                        <Typography.Text type="secondary">
                          这些变化会添加到商品或规格的制作信息中；多项说明会按点单选项顺序呈现。
                        </Typography.Text>
                        <Select
                          mode="multiple"
                          allowClear
                          showSearch
                          filterOption={false}
                          value={value.preparationEffect?.addProductionTagRefs ?? []}
                          options={productionTagOptions(value.preparationEffect?.addProductionTagRefs ?? [])}
                          loading={productionTagsLoading}
                          placeholder="只可选择要增加的标签"
                          onSearch={onProductionTagsSearch}
                          onPopupScroll={event => onProductionTagsPopupScroll(event)}
                          onChange={addProductionTagRefs => {
                            const nextRefs = addProductionTagRefs.map(String);
                            const nextEffect = buildAdditivePreparationEffect(
                              {
                                definitionValueRef: value.definitionValueRef,
                                optionGroupDisplayOrder: activeConfig.displayOrder,
                                optionValueDisplayOrder: value.displayOrder,
                              },
                              value.preparationEffect,
                              {addProductionTagRefs: nextRefs as CatalogPreparationEffect['addProductionTagRefs']},
                            );
                            updateValue(value.definitionValueRef, {preparationEffect: nextEffect});
                          }}
                          {...testId(`catalog-item-option-preparation-tags-${value.definitionValueRef}`)}
                        />
                         <InputNumber
                           min={0}
                           precision={0}
                           addonBefore="增加制作时长（秒）"
                          value={value.preparationEffect?.preparationSecondsDelta ?? undefined}
                          placeholder="填写零或正整数"
                          onChange={preparationSecondsDelta => {
                            const nextValue = preparationSecondsDelta ?? null;
                            const nextEffect = buildAdditivePreparationEffect(
                              {
                                definitionValueRef: value.definitionValueRef,
                                optionGroupDisplayOrder: activeConfig.displayOrder,
                                optionValueDisplayOrder: value.displayOrder,
                              },
                              value.preparationEffect,
                              {preparationSecondsDelta: nextValue},
                            );
                            updateValue(value.definitionValueRef, {preparationEffect: nextEffect});
                          }}
                           {...testId(`catalog-item-option-preparation-seconds-${value.definitionValueRef}`)}
                         />
                         <Typography.Text strong>追加制作说明</Typography.Text>
                         <Input.TextArea
                           maxLength={1000}
                          showCount
                          value={value.preparationEffect?.instruction ?? ''}
                          placeholder="例如：最后加冰"
                          onChange={event => {
                            const nextInstruction = event.target.value || null;
                            const nextEffect = buildAdditivePreparationEffect(
                              {
                                definitionValueRef: value.definitionValueRef,
                                optionGroupDisplayOrder: activeConfig.displayOrder,
                                optionValueDisplayOrder: value.displayOrder,
                              },
                              value.preparationEffect,
                              {instruction: nextInstruction},
                            );
                            updateValue(value.definitionValueRef, {preparationEffect: nextEffect});
                          }}
                          {...testId(`catalog-item-option-preparation-instruction-${value.definitionValueRef}`)}
                        />
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={7}>
            <Card size="small" title="顾客端显示效果">
              <Space direction="vertical" style={{display: 'flex'}} size="small">
                {values.map(config => (
                  <Card
                    key={config.definitionRef}
                    size="small"
                    title={
                      <Space>
                        <Typography.Text strong>{config.name}</Typography.Text>
                        <Tag>{config.selectionMode === 'SINGLE' ? '单选' : '多选'}</Tag>
                      </Space>
                    }
                  >
                    <Typography.Text type="secondary">
                      {config.selectionMode === 'SINGLE'
                        ? '请选择一项'
                        : `可选 ${config.minSelectionCount ?? 0} 至 ${config.maxSelectionCount ?? config.values.length} 项`}
                    </Typography.Text>
                    <Space wrap size={[4, 4]} style={{marginTop: 8}}>
                      {config.values.map(value => (
                        <Space key={value.definitionValueRef} wrap>
                          <Tag color={value.defaultValue ? 'blue' : undefined}>
                            {value.name}
                            {value.defaultValue ? '（默认）' : ''}
                          </Tag>
                          {value.extraPrice !== null && (
                            <Typography.Text type="secondary">加价 {money(value.extraPrice)}</Typography.Text>
                          )}
                          {value.preparationEffect && <Tag color="green">有制作变化</Tag>}
                        </Space>
                      ))}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </Space>
  );
}
function OrderOptionConfigurationsReadOnly({values}: {values: CatalogOrderOptionConfig[]}) {
  return values.length ? (
    <Space direction="vertical" style={{display: 'flex'}}>
      {values.map(config => (
        <Card
          key={config.definitionRef}
          size="small"
          title={config.name}
          extra={
            <Tag>
              {config.selectionMode === 'SINGLE'
                ? '单选'
                : `多选${config.maxSelectionCount === 1 ? '（最多 1 项）' : ''}`}
            </Tag>
          }
        >
          {config.values.map(value => (
            <Typography.Paragraph key={value.definitionValueRef} style={{marginBottom: 4}}>
              {value.name}
              {value.defaultValue ? '（默认）' : ''}
              {value.extraPrice !== null ? `，加价 ${money(value.extraPrice)}` : ''}
            </Typography.Paragraph>
          ))}
        </Card>
      ))}
    </Space>
  ) : (
    <EmptySection text="未维护点单选项" />
  );
}
