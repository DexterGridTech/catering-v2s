import {Alert, Button, Card, Col, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber, List, Modal, Row, Select, Skeleton, Space, Switch, Tabs, Tag, Tree, Typography, Upload} from 'antd';
import {adminWideDetailDescriptionsProps, adminWideDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {CatalogInventoryEnvelope, CatalogItemSaveRequest, JsonValue, ProductionTagPage, TemporaryPromotionExecuteRequest, TemporaryPromotionPreflight, TemporaryPromotionPreflightRequest} from '../../../app/api/generated/catalog-inventory-edge';
import type {OperationsPageProps} from '../../../app/routing/model';
import type {CatalogCompositeComponent, CatalogCompositeGroup, CatalogDetail, CatalogInventoryBomEntry, CatalogOrderOptionGroup, CatalogOrderOptionValue, CatalogSkuRow, CatalogSkuVariantDimension} from '../model/catalogModel';
import {decodeDetail, decodeItems, decodeNavigation, displayValue} from '../model/catalogModel';
import {CatalogDictionaryDrawer, type ProductionTagCandidate} from './CatalogDictionaryDrawer';
import {LocalCatalogCopyDrawer} from './LocalCatalogCopyDrawer';

type Props = {
  itemCode?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWrite: boolean;
  onOpenProductionTags?: () => void;
  onVoidAndRebuild?: (source: {name: string; shapeKey: string}) => void;
  onClose: () => void;
  onChanged: () => void;
};

const tabLabels: Record<string, string> = {basic: '基础', 'sku-specifications-pricing': 'SKU规格与价格', identifiers: '条码与识别', ordering: '点单与定价', 'order-options': '点单选项', attributes: '属性', 'production-prompts': '生产提示', 'inventory-bom': '库存与BOM', governance: '治理与引用', 'composite-content': '套餐内容'};
type MediaDraft = {id: string; assetRef?: string; fileName: string; mediaType: string; status: 'READY' | 'UPLOADING' | 'FAILED'; file?: File; error?: string; version?: number; staged: boolean; previous?: {assetRef?: string; version?: number; staged: boolean}};
type ProfileLayer = 'item' | 'sku' | 'optionValue';
type ProductionProfileDraft = CatalogDetail['item']['productionProfiles'];
type OrderingDraft = CatalogDetail['item']['ordering'];
type SkuDimensionDraft = CatalogSkuVariantDimension;
type SkuRowDraft = CatalogSkuRow;
type PromotionFormValues = Pick<TemporaryPromotionPreflightRequest, 'formalCode' | 'shapeKey' | 'name' | 'shortName' | 'materialRole'>;
const MAX_MEDIA_COUNT = 6;
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;

const profileLayerLabels: Record<ProfileLayer, string> = {item: '商品', sku: 'SKU', optionValue: '选项值'};
const promotionShapeLabels: Record<TemporaryPromotionPreflightRequest['shapeKey'], string> = {
  STANDARD_SALE_COUNTED: '普通销售商品（按件）',
  SKU_VARIANT_SALE_COUNTED: 'SKU 管理商品（按件）',
  STANDARD_SALE_WEIGHED: '普通销售商品（称重）',
  MATERIAL: '原材料',
  COMPOSITE: '套餐',
  SERVICE: '服务费',
  BENEFIT_SHELL: '权益壳（尚未开放）',
};
const profileFields: Array<{key: 'printName' | 'stationTags' | 'printTags' | 'estimatedPreparationSeconds' | 'preparationNotes' | 'allergens'; label: string; kind: 'text' | 'tags' | 'number'}> = [
  {key: 'printName', label: '打印名称', kind: 'text'},
  {key: 'stationTags', label: '处理标签', kind: 'tags'},
  {key: 'printTags', label: '打印标签', kind: 'tags'},
  {key: 'estimatedPreparationSeconds', label: '预计制作秒数', kind: 'number'},
  {key: 'preparationNotes', label: '生产备注', kind: 'text'},
  {key: 'allergens', label: '过敏原', kind: 'tags'},
];

async function contentDigest(file: File) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cloneOrdering(value: OrderingDraft): OrderingDraft { return {...value}; }
function cloneProfiles(value: ProductionProfileDraft): ProductionProfileDraft { return {item: {...value.item}, sku: {...value.sku}, optionValue: {...value.optionValue}}; }
function cloneSkuDimensions(value: SkuDimensionDraft[]): SkuDimensionDraft[] { return value.map((dimension) => ({...dimension, values: dimension.values.map((entry) => ({...entry}))})); }
function cloneSkuRows(value: SkuRowDraft[]): SkuRowDraft[] { return value.map((sku) => ({...sku, attributeValueRefs: sku.attributeValueRefs.map((entry) => ({...entry})), mediaRefs: [...sku.mediaRefs]})); }
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
function splitComma(value: string) { return value.split(',').map((entry) => entry.trim()).filter(Boolean); }
function profileDisplayValue(value: JsonValue) { return Array.isArray(value) ? value.map((entry) => displayValue(entry)).join('、') || '—' : displayValue(value); }

export function CatalogItemDrawer({itemCode, queryContext, brandRef, canWrite, onOpenProductionTags, onVoidAndRebuild, onClose, onChanged}: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [activeTab, setActiveTab] = useState('basic');
  const [problem, setProblem] = useState<string>();
  const [localCopyOpen, setLocalCopyOpen] = useState(false);
  const [productionTagQuickManageOpen, setProductionTagQuickManageOpen] = useState(false);
  const [selectedProductionTagRefs, setSelectedProductionTagRefs] = useState<string[]>([]);
  const [selectedProductionTags, setSelectedProductionTags] = useState<Array<{code: string; name: string; owner: string}>>([]);
  const initializedProductionItem = useRef<string | undefined>(undefined);
  const problemRef = useRef<HTMLDivElement | null>(null);
  const [mediaDraft, setMediaDraft] = useState<MediaDraft[]>([]);
  const initializedMediaItem = useRef<string | undefined>(undefined);
  const [mediaProblem, setMediaProblem] = useState<string>();
  const [identifierDraft, setIdentifierDraft] = useState<CatalogDetail['item']['identifiers']>([]);
  const [orderingDraft, setOrderingDraft] = useState<OrderingDraft>({priceGranularity: 'ITEM', standardSalePrice: null, listedSalePrice: null, missingPriceCount: 0});
  const [orderOptionsDraft, setOrderOptionsDraft] = useState<CatalogOrderOptionGroup[]>([]);
  const [productionProfilesDraft, setProductionProfilesDraft] = useState<ProductionProfileDraft>({item: {}, sku: {}, optionValue: {}});
  const [productionProfileLayer, setProductionProfileLayer] = useState<ProfileLayer>('item');
  const [inventoryBomDraft, setInventoryBomDraft] = useState<CatalogInventoryBomEntry[]>([]);
  const [compositeGroupsDraft, setCompositeGroupsDraft] = useState<CatalogCompositeGroup[]>([]);
  const [skuVariantDimensionsDraft, setSkuVariantDimensionsDraft] = useState<SkuDimensionDraft[]>([]);
  const [skusDraft, setSkusDraft] = useState<SkuRowDraft[]>([]);
  const [promotion, setPromotion] = useState<TemporaryPromotionPreflight['data']>();
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionProblem, setPromotionProblem] = useState<string>();
  const [form] = Form.useForm<{displayName: string; shortName?: string; attributesText: string}>();
  const [promotionForm] = Form.useForm<PromotionFormValues>();
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const request = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogItem({itemCode: itemCode ?? ''}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers}), [headers, itemCode, queryContext.scopeRef]);
  const detailQuery = operationsRtk.useGetOperationsCatalogItemQuery(request, {skip: !itemCode});
  const detail = useMemo(() => decodeDetail(detailQuery.data as CatalogInventoryEnvelope | undefined), [detailQuery.data]);
  const productionTagsRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsProductionTags({}, {query: {dataNodeRef: queryContext.scopeRef ?? ''}, headers}), [headers, queryContext.scopeRef]);
  const productionTagsQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionTagsRequest, {skip: !itemCode || !canWrite});
  const availableProductionTags = (((productionTagsQuery.data as CatalogInventoryEnvelope | undefined)?.data as ProductionTagPage['data'] | undefined)?.entries ?? []).map((entry) => ({code: entry.code, name: entry.name, owner: 'fulfillment-production'}));
  const [save] = operationsRtk.useSaveOperationsCatalogItemMutation();
  const [stageAsset] = operationsRtk.useStageOperationsCatalogAssetMutation();
  const [releaseAsset] = operationsRtk.useReleaseOperationsCatalogStagedAssetMutation();
  const [transition] = operationsRtk.useTransitionOperationsCatalogItemStatusMutation();
  const [preflightPromotion, preflightPromotionState] = operationsRtk.usePreflightOperationsTemporaryCatalogItemPromotionMutation();
  const [executePromotion, executePromotionState] = operationsRtk.useExecuteOperationsTemporaryCatalogItemPromotionMutation();
  const releaseStagedAsset = useCallback(async (asset: MediaDraft) => {
    if (!asset.staged || !asset.assetRef || asset.version === undefined) return true;
    try {
      await releaseAsset(catalogInventoryRtkRequest.releaseOperationsCatalogStagedAsset({assetRef: asset.assetRef}, {
        headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()},
        body: {assetRef: asset.assetRef, expectedVersion: asset.version},
      })).unwrap();
      return true;
    } catch (error) {
      setMediaProblem(operationsProblemOf(error).detail || '图片资产释放未完成，请重试。');
      return false;
    }
  }, [headers, releaseAsset]);
  const releaseStagedMedia = useCallback(async (assets: MediaDraft[]) => {
    const staged = assets.filter((asset) => asset.staged && asset.assetRef && asset.version !== undefined);
    const outcomes = await Promise.all(staged.map((asset) => releaseStagedAsset(asset)));
    return outcomes.every(Boolean);
  }, [releaseStagedAsset]);
  const lifecycle = useDrawerFormLifecycle({open: Boolean(itemCode), onOpenChange: (open) => { if (!open) { void releaseStagedMedia(mediaDraft); onClose(); } }, dirtyMessage: '商品编辑内容尚未保存。', dirtyGuardTestIds: {confirm: testId('catalog-item-dirty-discard'), cancel: testId('catalog-item-dirty-continue')}, diagnosticOperationId: 'catalog-item-editor', idempotencyKey: true});
  useEffect(() => {
    if (!detail) return;
    form.setFieldsValue({displayName: detail.item.name, shortName: detail.item.shortName ?? '', attributesText: JSON.stringify(detail.item.attributes, null, 2)});
    setIdentifierDraft(detail.item.identifiers.map((entry) => ({...entry})));
    setOrderingDraft(cloneOrdering(detail.item.ordering));
    setOrderOptionsDraft(detail.item.orderOptions.map((group) => ({...group, values: group.values.map((entry) => ({...entry, productionEffects: [...entry.productionEffects]}))})));
    setProductionProfilesDraft(cloneProfiles(detail.item.productionProfiles));
    setProductionProfileLayer('item');
    setInventoryBomDraft(detail.inventoryBom.map((entry) => ({...entry})));
    setCompositeGroupsDraft(detail.compositeGroups.map((group) => ({...group, components: group.components.map((entry) => ({...entry}))})));
    setSkuVariantDimensionsDraft(cloneSkuDimensions(detail.item.skuVariantDimensions));
    setSkusDraft(cloneSkuRows(detail.item.skus));
    if (initializedProductionItem.current !== detail.item.code) {
      initializedProductionItem.current = detail.item.code;
      setSelectedProductionTagRefs(detail.item.productionTagRefs);
      setSelectedProductionTags(detail.productionTags);
    }
    if (initializedMediaItem.current !== detail.item.code) {
      initializedMediaItem.current = detail.item.code;
      setMediaDraft(detail.item.images.map((assetRef, index) => ({id: `existing-${assetRef}-${index}`, assetRef, fileName: assetRef, mediaType: 'image/*', status: 'READY', staged: false})));
      setMediaProblem(undefined);
    }
    const first = detail.tabs.find((tab) => tab.visible)?.tabKey;
    setActiveTab((current) => detail.tabs.some((tab) => tab.tabKey === current && tab.visible) ? current : first ?? 'basic');
  }, [detail, form]);
  useEffect(() => {
    if (!(problem || detailQuery.error || mediaProblem)) return;
    window.requestAnimationFrame(() => problemRef.current?.focus());
  }, [detailQuery.error, mediaProblem, problem]);
  useEffect(() => { if (!itemCode) { initializedProductionItem.current = undefined; initializedMediaItem.current = undefined; setMode('view'); setProblem(undefined); setMediaProblem(undefined); setMediaDraft([]); setIdentifierDraft([]); setOrderOptionsDraft([]); setProductionProfilesDraft({item: {}, sku: {}, optionValue: {}}); setInventoryBomDraft([]); setCompositeGroupsDraft([]); setSkuVariantDimensionsDraft([]); setSkusDraft([]); setLocalCopyOpen(false); setProductionTagQuickManageOpen(false); setPromotion(undefined); setPromotionOpen(false); setPromotionProblem(undefined); lifecycle.reset(); } }, [itemCode, lifecycle]);

  const submit = async () => {
    if (!detail || !itemCode) return;
    if (mediaDraft.some((asset) => asset.status === 'UPLOADING')) {
      setMediaProblem('图片仍在上传或处理中，请等待完成后再保存。');
      setActiveTab('basic');
      return;
    }
    if (mediaDraft.some((asset) => asset.status === 'FAILED' && !asset.assetRef)) {
      setMediaProblem('存在未完成的图片上传，请重试或移除失败项后再保存。');
      setActiveTab('basic');
      return;
    }
    const values = await form.validateFields();
    let attributes: Record<string, JsonValue>;
    try {
      const parsed: unknown = JSON.parse(values.attributesText || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ATTRIBUTES_OBJECT_REQUIRED');
      attributes = parsed as Record<string, JsonValue>;
    } catch {
      setProblem('描述属性必须是 JSON 对象。');
      return;
    }
    const visibleTabs = new Set(detail.tabs.filter((tab) => tab.visible).map((tab) => tab.tabKey));
    if (visibleTabs.has('identifiers')) {
      const invalidIndex = identifierDraft.findIndex((entry) => !entry.kind.trim() || !entry.code.trim() || !entry.value.trim());
      if (invalidIndex >= 0) { setActiveTab('identifiers'); setProblem(`条码与识别码第 ${invalidIndex + 1} 行缺少类型、编码或识别码。`); return; }
    }
    if (visibleTabs.has('order-options')) {
      const invalidGroup = orderOptionsDraft.findIndex((group) => !group.groupCode.trim() || !group.groupName.trim() || group.values.some((value) => !value.code.trim() || !value.name.trim()));
      if (invalidGroup >= 0) { setActiveTab('order-options'); setProblem(`点单选项第 ${invalidGroup + 1} 组缺少组编码、组名或选项值信息。`); return; }
    }
    if (visibleTabs.has('sku-specifications-pricing')) {
      const invalidDimension = skuVariantDimensionsDraft.findIndex((dimension) => !dimension.attributeCode.trim() || !dimension.attributeName.trim() || dimension.values.some((value) => !value.valueCode.trim() || !value.valueLabel.trim()));
      const seenSkuCodes = new Set<string>();
      let invalidSku = -1;
      for (let index = 0; index < skusDraft.length; index += 1) {
        const sku = skusDraft[index];
        const code = sku.skuCode.trim();
        if (!code || !sku.skuName.trim() || seenSkuCodes.has(code) || (orderingDraft.priceGranularity === 'SKU' && sku.status === 'ENABLED' && sku.standardSalePrice === null)) { invalidSku = index; break; }
        seenSkuCodes.add(code);
      }
      if (invalidDimension >= 0) { setActiveTab('sku-specifications-pricing'); setProblem(`SKU 规格第 ${invalidDimension + 1} 个维度缺少属性编码、名称或属性值信息。`); return; }
      if (invalidSku >= 0) { setActiveTab('sku-specifications-pricing'); setProblem(`SKU 矩阵第 ${invalidSku + 1} 行缺少编码/名称、存在重复编码，或按 SKU 定价但启用 SKU 缺少标准价。`); return; }
    }
    if (visibleTabs.has('inventory-bom')) {
      const invalidNode = inventoryBomDraft.findIndex((node) => {
        if (node.mode === 'NONE') return false;
        if (node.mode === 'BOM') return !node.targetRef.trim() || !node.quantity.trim() || !node.unit.trim();
        if (node.mode === 'INDEPENDENT_STOCK') return !(node.targetRef.trim() || node.consumptionUnit?.trim());
        return true;
      });
      if (invalidNode >= 0) { setActiveTab('inventory-bom'); setProblem(`库存/BOM 第 ${invalidNode + 1} 个节点缺少合法模式、消耗数量/单位，或新建库存对象缺少消耗单位。`); return; }
    }
    if (visibleTabs.has('composite-content')) {
      const invalidGroup = compositeGroupsDraft.findIndex((group) => !group.groupCode.trim() || !group.groupName.trim() || group.components.some((component) => !component.itemCode.trim() || !component.quantity.trim() || !component.unit.trim()));
      if (invalidGroup >= 0) { setActiveTab('composite-content'); setProblem(`套餐内容第 ${invalidGroup + 1} 组缺少分组编码、分组名或组件数量/单位。`); return; }
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    try {
      const catalogDraft: CatalogItemSaveRequest['sections']['catalogDraft'] = {
        shortName: values.shortName?.trim() || null,
        name: values.displayName,
        shapeKey: detail.item.shapeKey,
        attributes,
        images: mediaDraft.filter((asset) => (asset.status === 'READY' || asset.status === 'FAILED') && asset.assetRef).map((asset) => asset.assetRef as string),
        productionTagRefs: selectedProductionTagRefs,
        categoryRefs: detail.item.categoryRefs,
      };
      if (visibleTabs.has('identifiers')) catalogDraft.identifiers = identifierDraft;
      if (visibleTabs.has('ordering') || visibleTabs.has('sku-specifications-pricing')) catalogDraft.ordering = orderingDraft;
      if (visibleTabs.has('sku-specifications-pricing')) {
        catalogDraft.skuVariantDimensions = skuVariantDimensionsDraft;
        catalogDraft.skus = skusDraft;
      }
      if (visibleTabs.has('order-options')) catalogDraft.orderOptions = orderOptionsDraft;
      if (visibleTabs.has('composite-content')) catalogDraft.compositeGroups = compositeGroupsDraft;
      if (visibleTabs.has('production-prompts')) catalogDraft.productionProfiles = productionProfilesDraft;
      if (visibleTabs.has('inventory-bom')) catalogDraft.inventoryBom = inventoryBomDraft;
      await save(catalogInventoryRtkRequest.saveOperationsCatalogItem({itemCode}, {headers: {...headers, 'Idempotency-Key': lifecycle.getIdempotencyKey()}, body: {
        dataNodeRef: queryContext.scopeRef ?? undefined,
        itemCode,
        sections: {
          catalogDraft,
          inventoryConfiguration: {nodes: visibleTabs.has('inventory-bom') ? inventoryBomDraft.filter((node) => node.mode === 'INDEPENDENT_STOCK').map((node) => ({
            nodeType: node.nodeType,
            mode: node.mode,
            ...(node.targetRef.trim() ? {targetRef: node.targetRef.trim()} : {}),
            itemCode: node.itemCode ?? detail.item.code,
            skuCode: node.skuCode ?? null,
            ...(node.consumptionUnit?.trim() ? {consumptionUnit: node.consumptionUnit.trim()} : {}),
            ...(node.configuration ? {configuration: node.configuration} : {}),
          })) : []},
          expectedCatalogVersion: detail.item.version,
          expectedInventoryVersions: visibleTabs.has('inventory-bom') ? inventoryBomDraft.filter((node) => node.mode === 'INDEPENDENT_STOCK' && node.targetRef.trim() && node.version !== undefined).map((node) => ({targetRef: node.targetRef, version: node.version as number})) : [],
        },
      }})).unwrap();
      lifecycle.reset();
      setMode('view');
      setMediaDraft((current) => current.map((asset) => ({...asset, file: undefined, staged: false})));
      await detailQuery.refetch();
      onChanged();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
      lifecycle.setSubmitting(false);
    }
  };
  const changeStatus = async (targetStatus: 'ENABLED' | 'DISABLED' | 'ARCHIVED' | 'VOIDED') => {
    if (!detail || !itemCode) return;
    if (targetStatus === 'VOIDED' && !detail.actionAvailability.voidAvailability?.canVoid) return;
    setProblem(undefined);
    try {
      await transition(catalogInventoryRtkRequest.transitionOperationsCatalogItemStatus({itemCode}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body: {itemCode, targetStatus, expectedVersion: detail.item.version}})).unwrap();
      await detailQuery.refetch();
      onChanged();
      if (targetStatus === 'VOIDED') onVoidAndRebuild?.({name: detail.item.name, shapeKey: detail.item.shapeKey});
    } catch (error) { setProblem(operationsProblemOf(error).detail); }
  };
  const voidAndRebuild = () => {
    if (!detail?.actionAvailability.voidAvailability?.canVoid) return;
    Modal.confirm({
      title: `作废并重建“${detail.item.name}”`,
      content: '将先把旧商品置为作废并永久保留原编码，然后用新编码创建一条商品。旧编码不会释放。',
      okText: '作废并继续重建',
      cancelText: '取消',
      onOk: () => changeStatus('VOIDED'),
    });
  };
  const runPromotionPreflight = async (values: PromotionFormValues) => {
    if (!itemCode || !detail) return;
    setPromotion(undefined);
    setPromotionProblem(undefined);
    const body: TemporaryPromotionPreflightRequest = {
      itemCode,
      formalCode: values.formalCode.trim(),
      shapeKey: values.shapeKey,
      name: values.name.trim(),
      shortName: values.shortName?.trim() || null,
      materialRole: values.materialRole?.trim() || null,
      attributes: detail.item.attributes,
      expectedSourceVersion: detail.item.version,
    };
    try {
      const response = await preflightPromotion(catalogInventoryRtkRequest.preflightOperationsTemporaryCatalogItemPromotion({itemCode}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body})).unwrap();
      const value = (response as CatalogInventoryEnvelope<TemporaryPromotionPreflight>)?.data?.data;
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
      await executePromotion(catalogInventoryRtkRequest.executeOperationsTemporaryCatalogItemPromotion({itemCode}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body})).unwrap();
      const codeChanged = values.formalCode.trim() !== detail.item.code;
      setPromotion(undefined); setPromotionOpen(false); setPromotionProblem(undefined);
      if (codeChanged) onClose();
      else await detailQuery.refetch();
      onChanged();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      setPromotionProblem(feedback.errorCode === 'STALE_COPY_PREFLIGHT' ? '预检已失效（STALE_COPY_PREFLIGHT），来源或资料已变化，请重新预检。' : feedback.detail || '临时商品转正未完成，请重试。');
    }
  };
  const onProductionTagCreated = (candidate: ProductionTagCandidate) => {
    setSelectedProductionTags((current) => current.some((tag) => tag.code === candidate.code) ? current : [...current, candidate]);
    setSelectedProductionTagRefs((current) => current.includes(candidate.code) ? current : [...current, candidate.code]);
    lifecycle.setDirty(true);
    setProductionTagQuickManageOpen(false);
  };
  const stageMedia = async (file: File, existingId?: string) => {
    if (!existingId && mediaDraft.length >= MAX_MEDIA_COUNT) { setMediaProblem(`最多维护 ${MAX_MEDIA_COUNT} 张图片（1 张主图 + 5 张附图）。`); return; }
    if (file.size > MAX_MEDIA_BYTES) { setMediaProblem('单张图片不能超过 2MB。'); return; }
    const id = existingId ?? globalThis.crypto.randomUUID();
    setMediaProblem(undefined);
    const previous = existingId ? mediaDraft.find((asset) => asset.id === existingId) : undefined;
    setMediaDraft((current) => existingId ? current.map((asset) => asset.id === existingId ? {...asset, assetRef: undefined, version: undefined, file, fileName: file.name, mediaType: file.type || 'application/octet-stream', status: 'UPLOADING', error: undefined, staged: true, previous: previous ? {assetRef: previous.assetRef, version: previous.version, staged: previous.staged} : undefined} : asset) : [...current, {id, file, fileName: file.name, mediaType: file.type || 'application/octet-stream', status: 'UPLOADING', staged: true}]);
    try {
      const digest = await contentDigest(file);
      const body = {fileName: file.name, content: file, mediaType: file.type || 'application/octet-stream', contentDigest: digest};
      const response = await stageAsset(catalogInventoryRtkRequest.stageOperationsCatalogAsset({}, {headers: {...headers, 'Idempotency-Key': globalThis.crypto.randomUUID()}, body})).unwrap();
      const responseEnvelope = response as CatalogInventoryEnvelope;
      const result = responseEnvelope.result as CatalogInventoryEnvelope['result'];
      const readback = (result && typeof result === 'object' && 'result' in result ? result.result : result) as {assetRef?: string; mediaType?: string; version?: number} | undefined;
      if (!readback?.assetRef) throw new Error('CATALOG_ASSET_STAGE_READBACK_MISSING');
      const previousAsset = mediaDraft.find((asset) => asset.id === id)?.previous;
      if (previousAsset?.staged && previousAsset.assetRef && previousAsset.version !== undefined) {
        await releaseStagedAsset({...previousAsset, id: `${id}-previous`, fileName: previousAsset.assetRef, mediaType: file.type, status: 'READY'});
      }
      setMediaDraft((current) => current.map((asset) => asset.id === id ? {...asset, assetRef: readback.assetRef, mediaType: readback.mediaType ?? file.type, status: 'READY', version: readback.version, staged: true, previous: undefined} : asset));
      lifecycle.setDirty(true);
    } catch (error) {
      const previousAsset = mediaDraft.find((asset) => asset.id === id)?.previous;
      setMediaDraft((current) => current.map((asset) => asset.id === id ? {...asset, assetRef: previousAsset?.assetRef, version: previousAsset?.version, staged: previousAsset?.staged ?? true, previous: undefined, status: 'FAILED', error: operationsProblemOf(error).detail || '上传失败，请重试。'} : asset));
      setMediaProblem(undefined);
    }
  };
  const removeMedia = async (id: string, index: number) => {
    if (index === 0 && mediaDraft.length > 1) { setMediaProblem('仍有其他图片时，请先指定新的主图。'); return; }
    const asset = mediaDraft.find((entry) => entry.id === id);
    if (!asset) return;
    if (!await releaseStagedAsset(asset)) return;
    setMediaDraft((current) => current.filter((asset) => asset.id !== id));
    setMediaProblem(undefined);
    lifecycle.setDirty(true);
  };
  const moveMedia = (id: string, offset: -1 | 1) => {
    setMediaDraft((current) => {
      const index = current.findIndex((asset) => asset.id === id);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    lifecycle.setDirty(true);
  };
  const setPrimaryMedia = (id: string) => {
    setMediaDraft((current) => {
      const index = current.findIndex((asset) => asset.id === id);
      if (index <= 0) return current;
      const next = [...current];
      const [primary] = next.splice(index, 1);
      next.unshift(primary);
      return next;
    });
    lifecycle.setDirty(true);
  };
  const updateIdentifiers = (next: CatalogDetail['item']['identifiers']) => { setIdentifierDraft(next); lifecycle.setDirty(true); };
  const updateOrdering = (next: OrderingDraft) => { setOrderingDraft(next); lifecycle.setDirty(true); };
  const updateOrderOptions = (next: CatalogOrderOptionGroup[]) => { setOrderOptionsDraft(next); lifecycle.setDirty(true); };
  const updateProductionProfiles = (next: ProductionProfileDraft) => { setProductionProfilesDraft(next); lifecycle.setDirty(true); };
  const updateInventoryBom = (next: CatalogInventoryBomEntry[]) => { setInventoryBomDraft(next); lifecycle.setDirty(true); };
  const updateCompositeGroups = (next: CatalogCompositeGroup[]) => { setCompositeGroupsDraft(next); lifecycle.setDirty(true); };
  const updateSkuVariantDimensions = (next: SkuDimensionDraft[]) => { setSkuVariantDimensionsDraft(next); lifecycle.setDirty(true); };
  const updateSkus = (next: SkuRowDraft[]) => { setSkusDraft(next); lifecycle.setDirty(true); };
  const tabItems = detail ? detail.tabs.filter((tab) => tab.visible).map((tab) => ({key: tab.tabKey, label: tabLabels[tab.tabKey] ?? tab.tabKey, disabled: tab.disabled, children: <CatalogTabContent tabKey={tab.tabKey} detail={detail} editing={mode === 'edit'} canWrite={canWrite} form={form} mediaDraft={mediaDraft} onStageMedia={stageMedia} onRemoveMedia={removeMedia} onMoveMedia={moveMedia} onSetPrimaryMedia={setPrimaryMedia} availableProductionTags={availableProductionTags} selectedProductionTagRefs={selectedProductionTagRefs} selectedProductionTags={selectedProductionTags} onProductionTagsChange={(next) => { setSelectedProductionTagRefs(next); lifecycle.setDirty(true); }} identifierDraft={identifierDraft} orderingDraft={orderingDraft} orderOptionsDraft={orderOptionsDraft} productionProfilesDraft={productionProfilesDraft} productionProfileLayer={productionProfileLayer} onProductionProfileLayerChange={setProductionProfileLayer} inventoryBomDraft={inventoryBomDraft} compositeGroupsDraft={compositeGroupsDraft} skuVariantDimensionsDraft={skuVariantDimensionsDraft} skusDraft={skusDraft} queryContext={queryContext} brandRef={brandRef} currentItemCode={itemCode} onIdentifiersChange={updateIdentifiers} onOrderingChange={updateOrdering} onOrderOptionsChange={updateOrderOptions} onProductionProfilesChange={updateProductionProfiles} onInventoryBomChange={updateInventoryBom} onCompositeGroupsChange={updateCompositeGroups} onSkuVariantDimensionsChange={updateSkuVariantDimensions} onSkusChange={updateSkus} onDirty={() => lifecycle.setDirty(true)} onOpenProductionTags={onOpenProductionTags} onOpenProductionQuickManage={() => setProductionTagQuickManageOpen(true)}/> })) : [];
  const action = detail?.actionAvailability;
  // AUTO_SYNC is not an all-field read-only mode: the owner supplies the exact
  // deniedFields set, so local supplements (tags, prompts, attributes, etc.)
  // remain editable. Temporary items are the only whole-record read-only mode.
  const sourceLocked = detail ? detail.item.source === 'TEMPORARY' : false;
  return <Drawer title={detail ? <Space><NameCodeText name={detail.item.name} code={detail.item.code}/><Tag>{detail.item.shapeKey}</Tag><Tag color={detail.item.status === 'ENABLED' ? 'green' : 'default'}>{detail.item.status}</Tag></Space> : '商品详情'} open={Boolean(itemCode)} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} destroyOnHidden={false} maskClosable={!lifecycle.dirty} {...adminWideDrawerSurfaceProps} {...testId('catalog-inventory-item-drawer')}
    extra={detail && <Space>
      {mode === 'view' && canWrite && action?.canEdit && !sourceLocked && <Button onClick={() => setMode('edit')} {...testId('catalog-item-edit')}>编辑</Button>}
      {mode === 'view' && canWrite && action?.canEnable && <Button onClick={() => void changeStatus('ENABLED')}>启用</Button>}
      {mode === 'view' && canWrite && action?.canDisable && <Button onClick={() => void changeStatus('DISABLED')}>停用</Button>}
      {mode === 'view' && canWrite && action?.canArchive && <Button danger onClick={() => void changeStatus('ARCHIVED')}>归档</Button>}
      {mode === 'view' && canWrite && detail.item.status !== 'VOIDED' && <Button danger disabled={!action?.voidAvailability?.canVoid} title={action?.voidAvailability?.canVoid ? undefined : '存在 owner 阻断事实，暂不能作废'} onClick={voidAndRebuild} {...testId('catalog-item-void-and-rebuild')}>作废并重建</Button>}
      {mode === 'view' && canWrite && detail.item.status !== 'ARCHIVED' && <Button onClick={() => setLocalCopyOpen(true)} {...testId('catalog-item-copy-local-open')}>从已有商品复制配置</Button>}
      {mode === 'view' && canWrite && detail.item.source === 'TEMPORARY' && <Button loading={preflightPromotionState.isLoading} onClick={() => void openPromotion()} {...testId('catalog-item-temporary-promotion')}>治理转正</Button>}
      {mode === 'edit' && <Button onClick={lifecycle.requestClose}>取消</Button>}
      {mode === 'edit' && <Button type="primary" loading={lifecycle.submitting} onClick={() => void submit()} {...testId('catalog-item-save')}>保存</Button>}
    </Space>}>
    {detailQuery.isLoading && <Skeleton active {...testId('catalog-item-detail-loading')}/>} 
    {(problem || detailQuery.error || mediaProblem) && <div ref={problemRef} tabIndex={-1} style={{marginBottom: 16}} {...testId('catalog-item-problem')}><Alert type="error" showIcon title="商品操作未完成" description={problem ?? mediaProblem ?? '商品详情暂时无法获取，请重试。'} action={detailQuery.error ? <Button size="small" onClick={() => void detailQuery.refetch()} {...testId('catalog-item-problem-retry')}>重试</Button> : undefined}/></div>} 
    {detail?.item.source === 'AUTO_SYNC' && <Alert type="info" showIcon title="自动同步商品" description={`带锁字段（${detail.deniedFields.join('、') || '来源声明字段'}）由上游维护；未被锁定的本地补充字段仍可编辑。`} {...testId('catalog-item-source-auto_sync')}/>} 
    {detail?.item.source === 'TEMPORARY' && <>
      <Alert type="info" showIcon title="外部订单临时商品" description="该商品可被查看但不可创建销售项；完成资料补齐和转正预检后才可进入正式治理。" {...testId('catalog-item-source-temporary')}/>
      <Card size="small" title="来源与原始快照" style={{marginBottom: 16}} {...testId('catalog-item-temporary-source-facts')}>
        <Descriptions size="small" bordered column={2} items={[
          {key: 'source-order', label: '来源订单', children: detail.item.externalIdentity.sourceOrderRef || '—'},
          {key: 'source-record', label: '来源记录', children: detail.item.externalIdentity.sourceRecordRef || '—'},
          {key: 'source-item', label: '来源商品', children: detail.item.externalIdentity.sourceItemRef || '—'},
          {key: 'snapshot-name', label: '原始快照名称', children: detail.item.externalIdentity.snapshot?.name || '—'},
          {key: 'snapshot-specification', label: '原始快照规格', children: detail.item.externalIdentity.snapshot?.specification || '—'},
          {key: 'snapshot-price', label: '原始快照价格', children: money(detail.item.externalIdentity.snapshot?.price ?? null)},
        ]}/>
      </Card>
    </>}
    {detail && <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} {...testId('catalog-item-tabs')}/>} 
    <LocalCatalogCopyDrawer open={localCopyOpen} sourceItemCode={itemCode ?? ''} queryContext={queryContext} brandRef={brandRef} onClose={() => setLocalCopyOpen(false)} onCompleted={() => { setLocalCopyOpen(false); void detailQuery.refetch(); onChanged(); }}/>
    <CatalogDictionaryDrawer open={productionTagQuickManageOpen} initialKind="PRODUCTION_TAG" queryContext={queryContext} brandRef={brandRef} canWrite={canWrite} quickManage onCreated={onProductionTagCreated} onClose={() => setProductionTagQuickManageOpen(false)}/>
    <Modal title="外部订单临时商品转正预检" open={promotionOpen} onCancel={() => { setPromotionOpen(false); setPromotion(undefined); setPromotionProblem(undefined); }} okText="确认转正" cancelText="返回" okButtonProps={{disabled: !promotion?.canPromote, loading: executePromotionState.isLoading}} onOk={() => void executePromotionAction()} {...testId('catalog-temporary-promotion-preflight')}>
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {promotionProblem && <Alert type="error" showIcon title="预检未完成" description={promotionProblem} {...testId('catalog-temporary-promotion-problem')}/>} 
        <Form form={promotionForm} layout="vertical" onValuesChange={() => { setPromotion(undefined); setPromotionProblem(undefined); }}>
          <Space align="start" wrap style={{display: 'flex'}}>
            <Form.Item label="正式商品编码" name="formalCode" rules={[{required: true, message: '请输入正式商品编码'}, {pattern: /^[A-Z0-9][A-Z0-9_-]{1,63}$/, message: '请输入 2-64 位大写字母、数字、下划线或短横线'}]}>
              <Input {...testId('catalog-temporary-promotion-formal-code')}/>
            </Form.Item>
            <Form.Item label="商品名称" name="name" rules={[{required: true, message: '请输入商品名称'}]}>
              <Input {...testId('catalog-temporary-promotion-name')}/>
            </Form.Item>
            <Form.Item label="短名" name="shortName">
              <Input {...testId('catalog-temporary-promotion-short-name')}/>
            </Form.Item>
          </Space>
          <Form.Item label="商品形态" name="shapeKey" rules={[{required: true, message: '请选择商品形态'}]}>
            <Select options={Object.entries(promotionShapeLabels).map(([value, label]) => ({value, label, disabled: value === 'BENEFIT_SHELL'}))} {...testId('catalog-temporary-promotion-shape')}/>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.shapeKey !== current.shapeKey}>
            {({getFieldValue}) => getFieldValue('shapeKey') === 'MATERIAL' ? <Form.Item label="物料角色" name="materialRole" rules={[{required: true, message: '原材料必须填写物料角色'}]}><Input placeholder="例如：RAW_MATERIAL" {...testId('catalog-temporary-promotion-material-role')}/></Form.Item> : null}
          </Form.Item>
        </Form>
        {promotion && <>
          <Descriptions size="small" bordered items={[
            {key: 'item', label: '当前临时商品', children: <NameCodeText name={promotion.item.name} code={promotion.item.code}/>},
            {key: 'proposed', label: '拟转为', children: <NameCodeText name={promotion.proposed.name} code={promotion.proposed.code}/>},
            {key: 'shape', label: '形态', children: promotionShapeLabels[promotion.proposed.shapeKey as TemporaryPromotionPreflightRequest['shapeKey']] ?? promotion.proposed.shapeKey},
            {key: 'source', label: '来源', children: promotion.source},
            {key: 'sourceVersion', label: '来源版本', children: promotion.sourceVersion},
            {key: 'code', label: '编码可用性', children: promotion.formalCodeAvailable ? '可用' : '已占用（含历史记录）'},
            {key: 'status', label: '预检结果', children: promotion.canPromote ? '可转正' : '被阻断'},
          ]}/>
          {promotion.requiredFields.length > 0 && <Typography.Text type="secondary">本次需确认字段：{promotion.requiredFields.join('、')}</Typography.Text>}
          {promotion.changes.length > 0 && <Descriptions size="small" title="差异预览" items={promotion.changes.map((change) => ({key: change.field, label: change.field, children: `${change.before ?? '—'} → ${change.after ?? '—'}`}))}/>} 
          {promotion.blockedReasons.length > 0 && <Alert type="warning" showIcon title="存在阻断原因" description={promotion.blockedReasons.join('；')} {...testId('catalog-temporary-promotion-blocked')}/>} 
          <Typography.Text type="secondary">资料补齐与校验通过后才会改变治理状态；若来源版本、正式编码或输入资料变化，必须重新预检，历史引用继续按原快照回放。</Typography.Text>
        </>}
        <Button onClick={() => { void promotionForm.validateFields().then((values) => runPromotionPreflight(values)).catch(() => undefined); }} loading={preflightPromotionState.isLoading} {...testId('catalog-temporary-promotion-re-preflight')}>重新预检</Button>
      </Space>
    </Modal>
  </Drawer>;
}

function CatalogTabContent({tabKey, detail, editing, canWrite, form, mediaDraft, onStageMedia, onRemoveMedia, onMoveMedia, onSetPrimaryMedia, availableProductionTags, selectedProductionTagRefs, selectedProductionTags, onProductionTagsChange, identifierDraft, orderingDraft, orderOptionsDraft, productionProfilesDraft, productionProfileLayer, onProductionProfileLayerChange, inventoryBomDraft, compositeGroupsDraft, skuVariantDimensionsDraft, skusDraft, queryContext, brandRef, currentItemCode, onIdentifiersChange, onOrderingChange, onOrderOptionsChange, onProductionProfilesChange, onInventoryBomChange, onCompositeGroupsChange, onSkuVariantDimensionsChange, onSkusChange, onDirty, onOpenProductionTags, onOpenProductionQuickManage}: {tabKey: string; detail: NonNullable<ReturnType<typeof decodeDetail>>; editing: boolean; canWrite: boolean; form: ReturnType<typeof Form.useForm<{displayName: string; shortName?: string; attributesText: string}>>[0]; mediaDraft: MediaDraft[]; onStageMedia: (file: File, existingId?: string) => Promise<void>; onRemoveMedia: (id: string, index: number) => void | Promise<void>; onMoveMedia: (id: string, offset: -1 | 1) => void; onSetPrimaryMedia: (id: string) => void; availableProductionTags: Array<{code: string; name: string; owner: string}>; selectedProductionTagRefs: string[]; selectedProductionTags: Array<{code: string; name: string; owner: string}>; onProductionTagsChange: (next: string[]) => void; identifierDraft: CatalogDetail['item']['identifiers']; orderingDraft: OrderingDraft; orderOptionsDraft: CatalogOrderOptionGroup[]; productionProfilesDraft: ProductionProfileDraft; productionProfileLayer: ProfileLayer; onProductionProfileLayerChange: (next: ProfileLayer) => void; inventoryBomDraft: CatalogInventoryBomEntry[]; compositeGroupsDraft: CatalogCompositeGroup[]; skuVariantDimensionsDraft: SkuDimensionDraft[]; skusDraft: SkuRowDraft[]; queryContext: OperationsPageProps['queryContext']; brandRef?: string; currentItemCode?: string; onIdentifiersChange: (next: CatalogDetail['item']['identifiers']) => void; onOrderingChange: (next: OrderingDraft) => void; onOrderOptionsChange: (next: CatalogOrderOptionGroup[]) => void; onProductionProfilesChange: (next: ProductionProfileDraft) => void; onInventoryBomChange: (next: CatalogInventoryBomEntry[]) => void; onCompositeGroupsChange: (next: CatalogCompositeGroup[]) => void; onSkuVariantDimensionsChange: (next: SkuDimensionDraft[]) => void; onSkusChange: (next: SkuRowDraft[]) => void; onDirty: () => void; onOpenProductionTags?: () => void; onOpenProductionQuickManage: () => void}) {
  if (tabKey === 'basic' && editing) return <Space direction="vertical" size={16} style={{display: 'flex'}}><Form form={form} layout="vertical" onValuesChange={onDirty}>
    <Alert type="info" showIcon title="商品编码与形态创建后不可修改" style={{marginBottom: 16}}/>
    <Form.Item label="商品名称" name="displayName" rules={[{required: true, message: '请输入商品名称'}]}><Input disabled={detail.deniedFields.includes('name')} {...testId('catalog-item-edit-name')}/></Form.Item>
    <Form.Item label="短名" name="shortName"><Input disabled={detail.deniedFields.includes('shortName')} placeholder="用于列表或小票的短展示名" {...testId('catalog-item-edit-short-name')}/></Form.Item>
  </Form><CatalogAssetEditor mediaDraft={mediaDraft} onStageMedia={onStageMedia} onRemoveMedia={onRemoveMedia} onMoveMedia={onMoveMedia} onSetPrimaryMedia={onSetPrimaryMedia}/></Space>;
  if (tabKey === 'basic') return <Space direction="vertical" size={16} style={{display: 'flex'}}><Descriptions {...adminWideDetailDescriptionsProps} items={[
    {key: 'name', label: '商品名称', children: detail.item.name}, {key: 'shortName', label: '短名', children: detail.item.shortName || '—'}, {key: 'code', label: '商品编码', children: detail.item.code},
    {key: 'shape', label: '商品形态', children: detail.item.shapeKey}, {key: 'status', label: '状态', children: detail.item.status},
    {key: 'kind', label: '商品类型', children: detail.item.itemKind}, {key: 'measure', label: '计量模式', children: detail.item.measureMode},
    {key: 'capabilities', label: '使用能力', children: detail.item.usageCapabilities.join('、') || '—'}, {key: 'version', label: '版本', children: detail.item.version},
  ]}/><Descriptions {...adminWideDetailDescriptionsProps} items={[{key: 'images', label: '图片资产', children: <CatalogAssetGallery assetRefs={detail.item.images}/>} ]}/></Space>;
  if (tabKey === 'identifiers' && editing) return <IdentifierEditor values={identifierDraft} onChange={onIdentifiersChange} onDirty={onDirty}/>;
  if (tabKey === 'identifiers') return detail.item.identifiers.length ? <Descriptions {...adminWideDetailDescriptionsProps} items={detail.item.identifiers.map((entry, index) => ({key: `${entry.kind}-${index}`, label: entry.kind, children: <Space><NameCodeText name={entry.value} code={entry.code}/><Tag>绑定范围：商品</Tag><Tag>状态：当前契约未提供</Tag></Space>}))}/> : <EmptySection text="未维护条码与识别码"/>;
  if (tabKey === 'sku-specifications-pricing' && editing) return <SkuMatrixEditor dimensions={skuVariantDimensionsDraft} skus={skusDraft} onDimensionsChange={onSkuVariantDimensionsChange} onSkusChange={onSkusChange} onDirty={onDirty}/>;
  if (tabKey === 'sku-specifications-pricing') return <SkuMatrixReadOnly dimensions={detail.item.skuVariantDimensions} skus={detail.item.skus} summary={detail.item.skuSummary} ordering={detail.item.ordering}/>;
  if (tabKey === 'ordering' && editing) return <OrderingEditor value={orderingDraft} onChange={onOrderingChange} onDirty={onDirty} skuManaged={detail.item.ordering.priceGranularity === 'SKU'}/>;
  if (tabKey === 'ordering') return <Descriptions {...adminWideDetailDescriptionsProps} items={[{key: 'granularity', label: '价格粒度', children: detail.item.ordering.priceGranularity}, {key: 'standard', label: '标准销售价', children: money(detail.item.ordering.standardSalePrice)}, {key: 'listed', label: '挂牌价', children: money(detail.item.ordering.listedSalePrice)}, {key: 'missing', label: '缺价', children: detail.item.ordering.missingPriceCount ? `缺少 ${detail.item.ordering.missingPriceCount} 项` : '完整'}]}/>;
  if (tabKey === 'attributes' && editing) return <Form form={form} layout="vertical" onValuesChange={onDirty}><Form.Item label="描述属性（自由 JSON 对象）" name="attributesText" rules={[{validator: (_, value) => { if (!value?.trim()) return Promise.resolve(); try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Promise.resolve() : Promise.reject(new Error('属性必须是 JSON 对象')); } catch { return Promise.reject(new Error('属性必须是 JSON 对象')); } }}]}><Input.TextArea rows={12} placeholder={'例如：{\n  "origin": "直营"\n}'} {...testId('catalog-item-edit-attributes')}/></Form.Item></Form>;
  if (tabKey === 'attributes') return <FactMap value={detail.item.attributes} empty="未维护描述属性"/>;
  if (tabKey === 'order-options' && editing) return <OrderOptionsEditor values={orderOptionsDraft} onChange={onOrderOptionsChange} onDirty={onDirty}/>;
  if (tabKey === 'order-options') return <OrderOptionsReadOnly values={detail.orderOptions}/>;
  if (tabKey === 'production-prompts') {
    const tagMap = new Map([...detail.productionTags, ...availableProductionTags, ...selectedProductionTags].map((tag) => [tag.code, tag]));
    const selectedTags = selectedProductionTagRefs.map((code) => tagMap.get(code) ?? {code, name: code, owner: 'fulfillment-production'});
    const options = Array.from(tagMap.values()).map((tag) => ({label: tag.name || tag.code, value: tag.code}));
    return <Space direction="vertical" size={12} style={{display: 'flex'}}>
      {editing && canWrite ? <Select mode="multiple" value={selectedProductionTagRefs} options={options} placeholder="选择商品处理标签" onChange={onProductionTagsChange} style={{width: '100%'}} {...testId('catalog-production-tag-field')}/> : <Space wrap>{selectedTags.length ? selectedTags.map((tag) => <Tag key={tag.code}>{tag.name || tag.code} · owner:{tag.owner}</Tag>) : <EmptySection text="未维护生产提示或商品处理标签"/>}</Space>}
      {canWrite && editing && <Button onClick={onOpenProductionQuickManage} {...testId('catalog-production-tag-quick-manage')}>快速创建商品处理标签</Button>}
      {!editing && onOpenProductionTags && <Button type="link" onClick={onOpenProductionTags} {...testId('catalog-production-tag-owner-open')}>打开生产履约标签维护</Button>}
      {editing ? <ProductionProfileEditor layer={productionProfileLayer} profiles={productionProfilesDraft} onLayerChange={onProductionProfileLayerChange} onChange={onProductionProfilesChange} onDirty={onDirty}/> : <ProductionProfilesReadOnly profiles={detail.item.productionProfiles}/>} 
    </Space>;
  }
  if (tabKey === 'inventory-bom' && editing) return <InventoryBomEditor values={inventoryBomDraft} onChange={onInventoryBomChange} onDirty={onDirty}/>;
  if (tabKey === 'inventory-bom') return <InventoryBomReadOnly values={detail.inventoryBom}/>;
  if (tabKey === 'composite-content' && editing) return <CompositeGroupsEditor values={compositeGroupsDraft} onChange={onCompositeGroupsChange} onDirty={onDirty} queryContext={queryContext} brandRef={brandRef} currentItemCode={currentItemCode}/>;
  if (tabKey === 'composite-content') return <CompositeGroupsReadOnly values={detail.compositeGroups}/>;
  if (tabKey === 'governance') return <Descriptions {...adminWideDetailDescriptionsProps} items={[{key: 'status', label: '治理状态', children: detail.governance.status}, {key: 'references', label: '引用关系', children: detail.references.length ? detail.references.map((entry) => `${entry.referenceKind}:${entry.code}`).join('、') : '无引用'}]}/>;
  return <EmptySection text={editing ? '当前页签已进入编辑上下文；当前契约未提供可安全提交的字段，未渲染伪编辑控件。' : `${tabLabels[tabKey] ?? tabKey}尚未维护`}/>;
}

function IdentifierEditor({values, onChange, onDirty}: {values: CatalogDetail['item']['identifiers']; onChange: (next: CatalogDetail['item']['identifiers']) => void; onDirty: () => void}) {
  const update = (index: number, patch: Partial<CatalogDetail['item']['identifiers'][number]>) => onChange(values.map((entry, entryIndex) => entryIndex === index ? {...entry, ...patch} : entry));
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-identifiers-editor')}>
    <Alert type="info" showIcon title="按 SKU 管理商品的识别码应在 SKU 矩阵中维护；本页仅维护商品级识别码。"/>
    <Button onClick={() => { onChange([...values, {kind: 'BARCODE', code: '', value: ''}]); onDirty(); }} {...testId('catalog-item-identifier-add')}>新增识别码</Button>
    {values.length === 0 && <EmptySection text="未维护识别码，可新增一行"/>}
    {values.map((entry, index) => <Card key={`${entry.kind}-${index}`} size="small" title={`识别码 ${index + 1}`} extra={<Button danger type="link" onClick={() => { onChange(values.filter((_, entryIndex) => entryIndex !== index)); onDirty(); }} {...testId(`catalog-item-identifier-remove-${index}`)}>移除</Button>}>
      <Space wrap>
        <Input addonBefore="类型" value={entry.kind} onChange={(event) => { update(index, {kind: event.target.value}); onDirty(); }} {...testId(`catalog-item-identifier-kind-${index}`)}/>
        <Input addonBefore="编码" value={entry.code} onChange={(event) => { update(index, {code: event.target.value}); onDirty(); }} {...testId(`catalog-item-identifier-code-${index}`)}/>
        <Input addonBefore="识别码" value={entry.value} onChange={(event) => { update(index, {value: event.target.value}); onDirty(); }} {...testId(`catalog-item-identifier-value-${index}`)}/>
      </Space>
    </Card>)}
  </Space>;
}

function OrderingEditor({value, onChange, onDirty, skuManaged}: {value: OrderingDraft; onChange: (next: OrderingDraft) => void; onDirty: () => void; skuManaged: boolean}) {
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-ordering-editor')}>
    <Alert type="info" showIcon title="价格按分保存；按 SKU 管理商品的价格粒度由 SKU 矩阵决定。"/>
    <Space wrap>
      <Typography.Text>价格粒度</Typography.Text>
      <Select value={value.priceGranularity} disabled={skuManaged} options={[{label: '商品', value: 'ITEM'}, {label: 'SKU', value: 'SKU'}]} onChange={(priceGranularity: 'ITEM' | 'SKU') => { onChange({...value, priceGranularity}); onDirty(); }} {...testId('catalog-item-ordering-granularity')}/>
      <Typography.Text>标准销售价（分）</Typography.Text>
      <InputNumber value={value.standardSalePrice} min={0} precision={0} onChange={(standardSalePrice) => { onChange({...value, standardSalePrice: standardSalePrice ?? null}); onDirty(); }} {...testId('catalog-item-ordering-standard-price')}/>
      <Typography.Text>挂牌价（分）</Typography.Text>
      <InputNumber value={value.listedSalePrice} min={0} precision={0} onChange={(listedSalePrice) => { onChange({...value, listedSalePrice: listedSalePrice ?? null}); onDirty(); }} {...testId('catalog-item-ordering-listed-price')}/>
    </Space>
    <Typography.Text type="secondary">缺价数由 SKU/价格事实派生：{value.missingPriceCount}</Typography.Text>
  </Space>;
}

function SkuMatrixEditor({dimensions, skus, onDimensionsChange, onSkusChange, onDirty}: {dimensions: SkuDimensionDraft[]; skus: SkuRowDraft[]; onDimensionsChange: (next: SkuDimensionDraft[]) => void; onSkusChange: (next: SkuRowDraft[]) => void; onDirty: () => void}) {
  const updateDimension = (index: number, patch: Partial<SkuDimensionDraft>) => onDimensionsChange(dimensions.map((entry, entryIndex) => entryIndex === index ? {...entry, ...patch} : entry));
  const updateDimensionValue = (dimensionIndex: number, valueIndex: number, patch: Partial<SkuDimensionDraft['values'][number]>) => onDimensionsChange(dimensions.map((entry, entryIndex) => entryIndex === dimensionIndex ? {...entry, values: entry.values.map((value, index) => index === valueIndex ? {...value, ...patch} : value)} : entry));
  const updateSku = (index: number, patch: Partial<SkuRowDraft>) => onSkusChange(skus.map((entry, entryIndex) => entryIndex === index ? {...entry, ...patch} : entry));
  const updateSkuValueRef = (skuIndex: number, valueIndex: number, patch: Partial<SkuRowDraft['attributeValueRefs'][number]>) => onSkusChange(skus.map((entry, entryIndex) => entryIndex === skuIndex ? {...entry, attributeValueRefs: entry.attributeValueRefs.map((value, index) => index === valueIndex ? {...value, ...patch} : value)} : entry));
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-sku-matrix-editor')}>
    <Alert type="info" showIcon title="SKU 规格与价格属于商品 owner 的矩阵事实；编码创建后不可修改，属性值只能引用已存在的销售属性字典。"/>
    <Card size="small" title="规格维度" extra={<Button size="small" onClick={() => { onDimensionsChange([...dimensions, {attributeRef: '', attributeCode: '', attributeName: '', values: []}]); onDirty(); }} {...testId('catalog-item-sku-dimension-add')}>新增规格维度</Button>}>
      {dimensions.length === 0 && <EmptySection text="未维护 SKU 规格维度"/>}
      <Space direction="vertical" size={10} style={{display: 'flex'}}>
        {dimensions.map((dimension, dimensionIndex) => <Card key={`${dimension.attributeCode}-${dimensionIndex}`} size="small" title={`维度 ${dimensionIndex + 1}`} extra={<Button danger type="link" onClick={() => { onDimensionsChange(dimensions.filter((_, index) => index !== dimensionIndex)); onDirty(); }} {...testId(`catalog-item-sku-dimension-remove-${dimensionIndex}`)}>移除</Button>}>
          <Space wrap>
            <Input addonBefore="属性编码" value={dimension.attributeCode} disabled={Boolean(dimension.attributeRef)} onChange={(event) => { updateDimension(dimensionIndex, {attributeCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-dimension-code-${dimensionIndex}`)}/>
            <Input addonBefore="属性名称" value={dimension.attributeName} onChange={(event) => { updateDimension(dimensionIndex, {attributeName: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-dimension-name-${dimensionIndex}`)}/>
          </Space>
          <Divider style={{margin: '8px 0'}}/>
          <Button size="small" onClick={() => { updateDimension(dimensionIndex, {values: [...dimension.values, {valueRef: '', valueCode: '', valueLabel: '', displayOrder: dimension.values.length, status: 'ENABLED'}]}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-add-${dimensionIndex}`)}>新增属性值引用</Button>
          <Space direction="vertical" size={6} style={{display: 'flex', marginTop: 8}}>
            {dimension.values.map((value, valueIndex) => <Space key={`${value.valueCode}-${valueIndex}`} wrap>
              <Input addonBefore="值编码" value={value.valueCode} disabled={Boolean(value.valueRef)} onChange={(event) => { updateDimensionValue(dimensionIndex, valueIndex, {valueCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-code-${dimensionIndex}-${valueIndex}`)}/>
              <Input addonBefore="值名称" value={value.valueLabel} onChange={(event) => { updateDimensionValue(dimensionIndex, valueIndex, {valueLabel: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-label-${dimensionIndex}-${valueIndex}`)}/>
              <InputNumber addonBefore="顺序" min={0} precision={0} value={value.displayOrder} onChange={(displayOrder) => { updateDimensionValue(dimensionIndex, valueIndex, {displayOrder: displayOrder ?? 0}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-order-${dimensionIndex}-${valueIndex}`)}/>
              <Select value={value.status} options={[{value: 'ENABLED', label: '启用'}, {value: 'DISABLED', label: '停用'}, {value: 'ARCHIVED', label: '归档'}]} onChange={(status) => { updateDimensionValue(dimensionIndex, valueIndex, {status}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-status-${dimensionIndex}-${valueIndex}`)}/>
              <Button danger type="link" onClick={() => { updateDimension(dimensionIndex, {values: dimension.values.filter((_, index) => index !== valueIndex)}); onDirty(); }} {...testId(`catalog-item-sku-dimension-value-remove-${dimensionIndex}-${valueIndex}`)}>移除</Button>
            </Space>)}
          </Space>
        </Card>)}
      </Space>
    </Card>
    <Card size="small" title="SKU 矩阵" extra={<Button size="small" onClick={() => { onSkusChange([...skus, {productSkuRef: '', skuCode: '', skuName: '', attributeValueRefs: [], skuBarcode: '', standardSalePrice: null, isDefault: false, status: 'ENABLED', version: 0, mediaRefs: []}]); onDirty(); }} {...testId('catalog-item-sku-row-add')}>新增 SKU</Button>}>
      {skus.length === 0 && <EmptySection text="未维护 SKU；按 SKU 定价时启用 SKU 必须有标准价"/>}
      <Space direction="vertical" size={10} style={{display: 'flex'}}>
        {skus.map((sku, skuIndex) => <Card key={`${sku.skuCode}-${skuIndex}`} size="small" title={<Space><Typography.Text>SKU {skuIndex + 1}</Typography.Text><Typography.Text type="secondary">{sku.skuCode || '未编码'}</Typography.Text></Space>} extra={<Button danger type="link" onClick={() => { onSkusChange(skus.filter((_, index) => index !== skuIndex)); onDirty(); }} {...testId(`catalog-item-sku-row-remove-${skuIndex}`)}>移除</Button>}>
          <Space wrap>
            <Input addonBefore="SKU编码" value={sku.skuCode} disabled={Boolean(sku.productSkuRef)} onChange={(event) => { updateSku(skuIndex, {skuCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-code-${skuIndex}`)}/>
            <Input addonBefore="SKU名称" value={sku.skuName} onChange={(event) => { updateSku(skuIndex, {skuName: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-name-${skuIndex}`)}/>
            <Input addonBefore="条码" value={sku.skuBarcode} onChange={(event) => { updateSku(skuIndex, {skuBarcode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-barcode-${skuIndex}`)}/>
            <InputNumber addonBefore="标准价（分）" min={0} precision={0} value={sku.standardSalePrice} onChange={(standardSalePrice) => { updateSku(skuIndex, {standardSalePrice: standardSalePrice ?? null}); onDirty(); }} {...testId(`catalog-item-sku-price-${skuIndex}`)}/>
            <Select value={sku.status} options={[{value: 'ENABLED', label: '启用'}, {value: 'DISABLED', label: '停用'}, {value: 'ARCHIVED', label: '归档'}]} onChange={(status) => { updateSku(skuIndex, {status}); onDirty(); }} {...testId(`catalog-item-sku-status-${skuIndex}`)}/>
            <Space><Typography.Text>默认</Typography.Text><Switch checked={sku.isDefault} onChange={(isDefault) => { updateSku(skuIndex, {isDefault}); onDirty(); }} {...testId(`catalog-item-sku-default-${skuIndex}`)}/></Space>
          </Space>
          <Divider style={{margin: '8px 0'}}/>
          <Space direction="vertical" size={6} style={{display: 'flex'}}>
            <Typography.Text strong>属性值引用</Typography.Text>
            {sku.attributeValueRefs.map((value, valueIndex) => <Space key={`${value.attributeCode}-${value.valueCode}-${valueIndex}`} wrap>
              <Input addonBefore="属性编码" value={value.attributeCode} onChange={(event) => { updateSkuValueRef(skuIndex, valueIndex, {attributeCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-attribute-code-${skuIndex}-${valueIndex}`)}/>
              <Input addonBefore="值编码" value={value.valueCode} onChange={(event) => { updateSkuValueRef(skuIndex, valueIndex, {valueCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-attribute-value-code-${skuIndex}-${valueIndex}`)}/>
              <Input addonBefore="值名称" value={value.valueLabel} onChange={(event) => { updateSkuValueRef(skuIndex, valueIndex, {valueLabel: event.target.value}); onDirty(); }} {...testId(`catalog-item-sku-attribute-value-label-${skuIndex}-${valueIndex}`)}/>
              <Button danger type="link" onClick={() => { updateSku(skuIndex, {attributeValueRefs: sku.attributeValueRefs.filter((_, index) => index !== valueIndex)}); onDirty(); }} {...testId(`catalog-item-sku-attribute-remove-${skuIndex}-${valueIndex}`)}>移除</Button>
            </Space>)}
            <Button size="small" onClick={() => { updateSku(skuIndex, {attributeValueRefs: [...sku.attributeValueRefs, {attributeRef: '', attributeCode: '', attributeName: '', attributeValueRef: '', valueCode: '', valueLabel: '', displayOrder: sku.attributeValueRefs.length, status: 'ENABLED'}]}); onDirty(); }} {...testId(`catalog-item-sku-attribute-add-${skuIndex}`)}>新增属性值引用</Button>
          </Space>
        </Card>)}
      </Space>
    </Card>
  </Space>;
}

function SkuMatrixReadOnly({dimensions, skus, summary, ordering}: {dimensions: SkuDimensionDraft[]; skus: SkuRowDraft[]; summary: CatalogDetail['item']['skuSummary']; ordering: OrderingDraft}) {
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-sku-matrix-readonly')}>
    <Descriptions {...adminWideDetailDescriptionsProps} items={[{key: 'sku', label: 'SKU 数量', children: `${summary.enabledCount}/${summary.nonArchivedCount}/${summary.totalCount}（启用/未归档/总数）`}, {key: 'granularity', label: '价格粒度', children: ordering.priceGranularity}, {key: 'standard', label: '商品标准价', children: money(ordering.standardSalePrice)}, {key: 'listed', label: '挂牌价', children: money(ordering.listedSalePrice)}, {key: 'missing', label: '缺价数', children: ordering.missingPriceCount}]}/>
    <Card size="small" title="规格维度">{dimensions.length ? dimensions.map((dimension) => <Typography.Text key={dimension.attributeCode} style={{display: 'block'}}>{dimension.attributeName || dimension.attributeCode}（{dimension.attributeCode}）：{dimension.values.map((value) => `${value.valueLabel || value.valueCode}${value.status === 'ARCHIVED' ? ' · 归档' : ''}`).join('、') || '—'}</Typography.Text>) : <EmptySection text="未维护规格维度"/>}</Card>
    <Card size="small" title="SKU 明细">{skus.length ? <Space direction="vertical" size={8} style={{display: 'flex'}}>{skus.map((sku) => <Card key={sku.skuCode} size="small" title={<NameCodeText name={sku.skuName} code={sku.skuCode}/>}> <Descriptions size="small" column={2} items={[{key: 'refs', label: '属性值', children: sku.attributeValueRefs.map((value) => `${value.attributeName || value.attributeCode}=${value.valueLabel || value.valueCode}`).join('、') || '—'}, {key: 'barcode', label: '条码', children: sku.skuBarcode || '—'}, {key: 'price', label: '标准价', children: money(sku.standardSalePrice)}, {key: 'status', label: '状态', children: `${sku.status}${sku.isDefault ? ' · 默认' : ''}`}, {key: 'version', label: '版本', children: sku.version}]}/></Card>)}</Space> : <EmptySection text="未维护 SKU 明细"/>}</Card>
  </Space>;
}

function OrderOptionsEditor({values, onChange, onDirty}: {values: CatalogOrderOptionGroup[]; onChange: (next: CatalogOrderOptionGroup[]) => void; onDirty: () => void}) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const updateGroup = (index: number, patch: Partial<CatalogOrderOptionGroup>) => onChange(values.map((group, groupIndex) => groupIndex === index ? {...group, ...patch} : group));
  const updateValue = (groupIndex: number, valueIndex: number, patch: Partial<CatalogOrderOptionValue>) => onChange(values.map((group, index) => index === groupIndex ? {...group, values: group.values.map((value, entryIndex) => entryIndex === valueIndex ? {...value, ...patch} : value)} : group));
  useEffect(() => { if (selectedGroupIndex >= values.length) setSelectedGroupIndex(Math.max(0, values.length - 1)); }, [selectedGroupIndex, values.length]);
  const selectedGroup = values[selectedGroupIndex];
  const selectedErrors = selectedGroup ? [
    !selectedGroup.groupCode.trim() ? '组编码不能为空' : undefined,
    !selectedGroup.groupName.trim() ? '组名不能为空' : undefined,
    selectedGroup.values.length === 0 ? '至少添加一个选项值' : undefined,
    ...selectedGroup.values.flatMap((value, index) => [!value.code.trim() ? `第 ${index + 1} 个选项值缺少编码` : undefined, !value.name.trim() ? `第 ${index + 1} 个选项值缺少名称` : undefined]),
  ].filter((entry): entry is string => Boolean(entry)) : [];
  const addGroup = () => { const next = [...values, {groupCode: '', groupName: '', selectionMode: 'SINGLE', required: false, values: []}]; onChange(next); setSelectedGroupIndex(next.length - 1); onDirty(); };
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-order-options-editor')}>
    <Alert type="info" showIcon title="点单选项由商品 owner 内联维护；左侧选择分组，中间编辑事实，右侧实时预览并显示具体校验原因。"/>
    <Button onClick={addGroup} {...testId('catalog-item-order-option-group-add')}>新增选项组</Button>
    {values.length === 0 ? <EmptySection text="未维护点单选项组"/> : <Row gutter={12} align="top">
      <Col span={6}><Card size="small" title="点单分组" {...testId('catalog-item-order-options-groups')}>
        <List size="small" dataSource={values} renderItem={(group, index) => <List.Item key={`${group.groupCode}-${index}`} onClick={() => setSelectedGroupIndex(index)} style={{cursor: 'pointer', background: index === selectedGroupIndex ? '#e6f4ff' : undefined, paddingInline: 8}} {...testId(`catalog-item-order-options-group-${index}`)}>
          <Space><Typography.Text strong={index === selectedGroupIndex}>{group.groupName || '未命名组'}</Typography.Text><Typography.Text type="secondary">{group.values.length}项</Typography.Text></Space>
        </List.Item>}/>
      </Card></Col>
      <Col span={12}><Card size="small" title={selectedGroup ? `选项组详情 · ${selectedGroup.groupName || '未命名组'}` : '选项组详情'} {...testId('catalog-item-order-options-details')}>
        {selectedGroup && <Space direction="vertical" size={8} style={{display: 'flex'}}>
          <Space wrap>
            <Input addonBefore="组编码" value={selectedGroup.groupCode} onChange={(event) => { updateGroup(selectedGroupIndex, {groupCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-order-option-group-code-${selectedGroupIndex}`)}/>
            <Input addonBefore="组名" value={selectedGroup.groupName} onChange={(event) => { updateGroup(selectedGroupIndex, {groupName: event.target.value}); onDirty(); }} {...testId(`catalog-item-order-option-group-name-${selectedGroupIndex}`)}/>
            <Select value={selectedGroup.selectionMode} options={[{label: '单选', value: 'SINGLE'}, {label: '多选', value: 'MULTIPLE'}, {label: '固定包含', value: 'FIXED'}]} onChange={(selectionMode) => { updateGroup(selectedGroupIndex, {selectionMode}); onDirty(); }} {...testId(`catalog-item-order-option-group-mode-${selectedGroupIndex}`)}/>
            <Space><Typography.Text>必选</Typography.Text><Switch checked={selectedGroup.required} onChange={(required) => { updateGroup(selectedGroupIndex, {required}); onDirty(); }} {...testId(`catalog-item-order-option-group-required-${selectedGroupIndex}`)}/></Space>
          </Space>
          <Divider style={{margin: '4px 0'}}/>
          <Space style={{justifyContent: 'space-between', width: '100%'}}><Typography.Text strong>选项值</Typography.Text><Space><Button size="small" onClick={() => { updateGroup(selectedGroupIndex, {values: [...selectedGroup.values, {code: '', name: '', default: false, extraPrice: null, productionEffects: []}]}); onDirty(); }} {...testId(`catalog-item-order-option-value-add-${selectedGroupIndex}`)}>新增选项值</Button><Button size="small" danger onClick={() => { onChange(values.filter((_, index) => index !== selectedGroupIndex)); onDirty(); }} {...testId(`catalog-item-order-option-group-remove-${selectedGroupIndex}`)}>移除组</Button></Space></Space>
          {selectedGroup.values.map((value, valueIndex) => <Card key={`${value.code}-${valueIndex}`} size="small" title={`选项值 ${valueIndex + 1}`}>
            <Space wrap>
              <Input addonBefore="值编码" value={value.code} onChange={(event) => { updateValue(selectedGroupIndex, valueIndex, {code: event.target.value}); onDirty(); }} {...testId(`catalog-item-order-option-value-code-${selectedGroupIndex}-${valueIndex}`)}/>
              <Input addonBefore="值名称" value={value.name} onChange={(event) => { updateValue(selectedGroupIndex, valueIndex, {name: event.target.value}); onDirty(); }} {...testId(`catalog-item-order-option-value-name-${selectedGroupIndex}-${valueIndex}`)}/>
              <InputNumber addonBefore="加价（分）" value={value.extraPrice} min={0} precision={0} onChange={(extraPrice) => { updateValue(selectedGroupIndex, valueIndex, {extraPrice: extraPrice ?? null}); onDirty(); }} {...testId(`catalog-item-order-option-value-price-${selectedGroupIndex}-${valueIndex}`)}/>
              <Input addonBefore="制作影响" value={value.productionEffects.join(',')} onChange={(event) => { updateValue(selectedGroupIndex, valueIndex, {productionEffects: splitComma(event.target.value)}); onDirty(); }} {...testId(`catalog-item-order-option-value-effects-${selectedGroupIndex}-${valueIndex}`)}/>
              <Space><Typography.Text>默认</Typography.Text><Switch checked={value.default} onChange={(defaultValue) => { updateValue(selectedGroupIndex, valueIndex, {default: defaultValue}); onDirty(); }} {...testId(`catalog-item-order-option-value-default-${selectedGroupIndex}-${valueIndex}`)}/></Space>
              <Button danger type="link" onClick={() => { updateGroup(selectedGroupIndex, {values: selectedGroup.values.filter((_, index) => index !== valueIndex)}); onDirty(); }} {...testId(`catalog-item-order-option-value-remove-${selectedGroupIndex}-${valueIndex}`)}>移除</Button>
            </Space>
          </Card>)}
        </Space>}
      </Card></Col>
      <Col span={6}><Card size="small" title="点单预览 / 校验" {...testId('catalog-item-order-options-preview')}>
        {selectedGroup ? <Space direction="vertical" size={8} style={{display: 'flex'}}>
          <Typography.Text strong>{selectedGroup.groupName || '未命名组'} {selectedGroup.required ? '（必选）' : '（可选）'}</Typography.Text>
          <Space wrap>{selectedGroup.values.map((value, index) => <Tag color={value.default ? 'blue' : undefined} key={`${value.code}-${index}`}>{value.name || value.code || '未命名值'}{value.extraPrice === null ? '' : ` +¥${(value.extraPrice / 100).toFixed(2)}`}</Tag>)}</Space>
          {selectedErrors.length ? <Alert type="warning" showIcon title="需要修复" description={<ul style={{paddingLeft: 16, margin: 0}}>{selectedErrors.map((error) => <li key={error}>{error}</li>)}</ul>} {...testId('catalog-item-order-options-validation')}/> : <Alert type="success" showIcon title="当前分组可提交" {...testId('catalog-item-order-options-validation')}/>} 
          <Typography.Text type="secondary">实时预览只反映当前草稿；保存前仍会由商品 owner 重新校验全部分组。</Typography.Text>
        </Space> : <Empty description="请选择一个点单分组"/>}
      </Card></Col>
    </Row>}
  </Space>;
}

function OrderOptionsReadOnly({values}: {values: CatalogOrderOptionGroup[]}) {
  if (!values.length) return <EmptySection text="未维护点单选项组"/>;
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-order-options-readonly')}>
    {values.map((group) => {
      const preview = group.values.map((value) => `${value.name || value.code}${value.default ? '（默认）' : ''}`).join('、') || '—';
      const valueRows = <Space direction="vertical" size={2}>{group.values.map((value, valueIndex) => <Typography.Text key={`${value.code}-${valueIndex}`}>{value.code || '—'} · {value.name || '—'} · {money(value.extraPrice)} · 制作影响：{value.productionEffects.join('、') || '—'}</Typography.Text>)}</Space>;
      return <Card key={group.groupCode || group.groupName} size="small" title={<Space><Typography.Text strong>{group.groupName || '未命名组'}</Typography.Text><Typography.Text type="secondary">{group.groupCode || '—'}</Typography.Text></Space>}>
        <Descriptions size="small" column={2} items={[{key: 'mode', label: '选择规则', children: `${group.selectionMode || '—'}${group.required ? ' · 必选' : ' · 可选'}`}, {key: 'preview', label: '点单预览', children: preview}]}/>
        {group.values.length > 0 && <Descriptions size="small" column={1} items={[{key: 'values', label: '选项值', children: valueRows}]}/>} 
      </Card>;
    })}
  </Space>;
}

function ProductionProfileEditor({layer, profiles, onLayerChange, onChange, onDirty}: {layer: ProfileLayer; profiles: ProductionProfileDraft; onLayerChange: (next: ProfileLayer) => void; onChange: (next: ProductionProfileDraft) => void; onDirty: () => void}) {
  const profile = profiles[layer];
  const setProfileValue = (key: string, value: JsonValue | undefined) => {
    const nextProfile = {...profile};
    if (value === undefined || value === '') delete nextProfile[key];
    else nextProfile[key] = value;
    onChange({...profiles, [layer]: nextProfile});
    onDirty();
  };
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-production-profile-editor')}>
    <Space wrap><Typography.Text strong>生产提示节点</Typography.Text><Select value={layer} options={Object.entries(profileLayerLabels).map(([value, label]) => ({value, label}))} onChange={onLayerChange} {...testId('catalog-production-profile-node')}/></Space>
    <Alert type="info" showIcon title="商品、SKU、选项值分别维护 typed production profile；切换节点不会隐式继承其他层。"/>
    {profileFields.map((field) => field.kind === 'tags' ? <Input key={field.key} addonBefore={field.label} value={profileTags(profile, field.key).join(',')} placeholder="多个值用逗号分隔" onChange={(event) => setProfileValue(field.key, splitComma(event.target.value))} {...testId(`catalog-production-profile-${field.key}`)}/> : field.kind === 'number' ? <InputNumber key={field.key} addonBefore={field.label} min={0} precision={0} value={profileNumber(profile, field.key)} onChange={(value) => setProfileValue(field.key, value ?? undefined)} {...testId(`catalog-production-profile-${field.key}`)}/> : <Input key={field.key} addonBefore={field.label} value={profileString(profile, field.key)} onChange={(event) => setProfileValue(field.key, event.target.value)} {...testId(`catalog-production-profile-${field.key}`)}/>)}
    {Object.keys(profile).some((key) => !profileFields.some((field) => field.key === key)) && <Typography.Text type="secondary">其他 typed 字段：{Object.keys(profile).filter((key) => !profileFields.some((field) => field.key === key)).join('、')}</Typography.Text>}
  </Space>;
}

function ProductionProfilesReadOnly({profiles}: {profiles: ProductionProfileDraft}) {
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-production-profile-readonly')}>
    {(Object.keys(profileLayerLabels) as ProfileLayer[]).map((layer) => <Card key={layer} size="small" title={profileLayerLabels[layer]}>
      {Object.keys(profiles[layer]).length ? <Descriptions size="small" column={2} items={Object.entries(profiles[layer]).map(([key, value]) => ({key, label: profileFields.find((field) => field.key === key)?.label ?? key, children: profileDisplayValue(value)}))}/> : <EmptySection text="未维护该节点的生产提示"/>}
    </Card>)}
  </Space>;
}

function InventoryBomEditor({values, onChange, onDirty}: {values: CatalogInventoryBomEntry[]; onChange: (next: CatalogInventoryBomEntry[]) => void; onDirty: () => void}) {
  const update = (index: number, patch: Partial<CatalogInventoryBomEntry>) => onChange(values.map((entry, entryIndex) => entryIndex === index ? {...entry, ...patch} : entry));
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-inventory-bom-editor')}>
    <Alert type="info" showIcon title="这里只维护库存节点/BOM 定义，不显示余额流水；库存对象只能从本商品页签建立，BOM 组件必须引用已有库存对象。"/>
    <Button onClick={() => { onChange([...values, {nodeType: 'ITEM', mode: 'INDEPENDENT_STOCK', targetRef: '', quantity: '0', unit: '', itemCode: '', skuCode: null, consumptionUnit: '', configuration: {allowNegative: false, lowStockThreshold: null, countingUnit: '', conversionFactor: '1'}}]); onDirty(); }} {...testId('catalog-item-inventory-bom-add')}>新增独立库存对象</Button>
    <Button onClick={() => { onChange([...values, {nodeType: 'ITEM_BOM', mode: 'BOM', targetRef: '', quantity: '1', unit: '', optionValueCode: null}]); onDirty(); }} {...testId('catalog-item-inventory-bom-add-line')}>新增 BOM 组件</Button>
    {values.length === 0 && <EmptySection text="未维护库存对象或 BOM"/>}
    {values.map((entry, index) => <Card key={`${entry.targetRef}-${index}`} size="small" title={`节点 ${index + 1}`} extra={<Button danger type="link" onClick={() => { onChange(values.filter((_, entryIndex) => entryIndex !== index)); onDirty(); }} {...testId(`catalog-item-inventory-bom-remove-${index}`)}>移除</Button>}>
      <Space wrap>
        <Typography.Text type="secondary">lineSign：{entry.lineSign ?? entry.nodeType}</Typography.Text>
        <Select value={entry.mode} options={[{value: 'NONE', label: '无库存'}, {value: 'INDEPENDENT_STOCK', label: '独立库存'}, {value: 'BOM', label: 'BOM'}]} onChange={(mode) => { update(index, {mode}); onDirty(); }} {...testId(`catalog-item-inventory-bom-mode-${index}`)}/>
        {entry.mode === 'BOM' && <>
          <Input addonBefore="BOM 所属选项值（可选）" value={entry.optionValueCode ?? ''} onChange={(event) => { update(index, {optionValueCode: event.target.value || null, nodeType: event.target.value ? 'OPTION_VALUE_BOM' : 'ITEM_BOM'}); onDirty(); }} {...testId(`catalog-item-inventory-bom-option-value-${index}`)}/>
          <Input addonBefore="已有库存对象" value={entry.targetRef} onChange={(event) => { update(index, {targetRef: event.target.value}); onDirty(); }} {...testId(`catalog-item-inventory-bom-target-${index}`)}/>
        </>}
        {entry.mode === 'INDEPENDENT_STOCK' && <Input addonBefore="消耗单位（新建时必填）" value={entry.consumptionUnit ?? ''} onChange={(event) => { update(index, {consumptionUnit: event.target.value}); onDirty(); }} {...testId(`catalog-item-inventory-bom-consumption-unit-${index}`)}/>} 
        <Input addonBefore="每份消耗" value={entry.quantity} onChange={(event) => { update(index, {quantity: event.target.value}); onDirty(); }} {...testId(`catalog-item-inventory-bom-quantity-${index}`)}/>
        <Input addonBefore="单位" value={entry.unit} onChange={(event) => { update(index, {unit: event.target.value}); onDirty(); }} {...testId(`catalog-item-inventory-bom-unit-${index}`)}/>
      </Space>
    </Card>)}
  </Space>;
}

function InventoryBomReadOnly({values}: {values: CatalogInventoryBomEntry[]}) {
  if (!values.length) return <EmptySection text="未维护库存对象或 BOM"/>;
  return <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-inventory-bom-readonly')}>
    {values.map((entry, index) => <Card key={`${entry.targetRef}-${index}`} size="small" title={`lineSign：${entry.nodeType}`}>
      <Descriptions size="small" column={2} items={[{key: 'mode', label: '允许模式', children: entry.mode}, {key: 'owner', label: 'BOM 所属选项值', children: entry.optionValueCode || '商品/SKU'}, {key: 'target', label: '库存对象', children: entry.targetRef || '—'}, {key: 'quantity', label: 'BOM 每份消耗', children: `${entry.quantity || '—'} ${entry.unit || ''}`}]}/>
    </Card>)}
  </Space>;
}

function CompositeCandidatePicker({value, currentItemCode, queryContext, brandRef, onSelect, testIdValue}: {value: string; currentItemCode?: string; queryContext: OperationsPageProps['queryContext']; brandRef?: string; onSelect: (itemCode: string) => void; testIdValue: string}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryRef, setCategoryRef] = useState<string>();
  const [cursor, setCursor] = useState('');
  const headers = useMemo(() => brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined, [brandRef]);
  const navigationRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogNavigation({}, {query: {dataNodeRef: queryContext.scopeRef ?? '', viewKey: 'ALL'}, headers}), [headers, queryContext.scopeRef]);
  const itemRequest = useMemo(() => catalogInventoryRtkRequest.getOperationsCatalogItems({}, {query: {dataNodeRef: queryContext.scopeRef ?? '', ...(keyword.trim() ? {keyword: keyword.trim()} : {}), ...(categoryRef ? {categoryRef, includeSubCategories: true} : {}), ...(cursor ? {cursor} : {}), pageSize: 20}, headers}), [categoryRef, cursor, headers, keyword, queryContext.scopeRef]);
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !open});
  const itemsQuery = operationsRtk.useGetOperationsCatalogItemsQuery(itemRequest, {skip: !open});
  const navigation = decodeNavigation(navigationQuery.data as CatalogInventoryEnvelope | undefined);
  const page = decodeItems(itemsQuery.data as CatalogInventoryEnvelope | undefined);
  const treeData = useMemo(() => buildCategoryTree(navigation.tree.filter((node) => node.nodeRef.startsWith('CATEGORY:') || Boolean(node.parentCode))), [navigation.tree]);
  useEffect(() => { if (!open) { setKeyword(''); setCategoryRef(undefined); setCursor(''); } }, [open]);
  return <>
    <Button onClick={() => setOpen(true)} {...testId(testIdValue)}>{value ? <NameCodeText name={value} code={value}/> : '选择组件商品'}</Button>
    {value && <Typography.Text type="secondary">已选商品编码：{value}</Typography.Text>}
    <Drawer title="选择套餐组件商品" open={open} onClose={() => setOpen(false)} {...adminWideDrawerSurfaceProps} {...testId(`${testIdValue}-drawer`)}>
      <Alert type="info" showIcon title="只能选择当前商品库中可引用的商品；候选查询由 catalog owner 提供，不能手写商品名称或编码。" style={{marginBottom: 12}}/>
      <Row gutter={12} align="top">
        <Col span={8}><Card size="small" title="分类" {...testId(`${testIdValue}-categories`)}>{treeData.length ? <Tree treeData={treeData} selectedKeys={categoryRef ? [categoryRef] : []} onSelect={(keys) => { setCategoryRef(String(keys[0] ?? '')); setCursor(''); }} /> : <Empty description="暂无分类"/>}</Card></Col>
        <Col span={16}><Space direction="vertical" size={12} style={{display: 'flex'}}>
          <Input.Search value={keyword} placeholder="在选定分类中搜索商品名称或编码" allowClear onChange={(event) => { setKeyword(event.target.value); setCursor(''); }} onSearch={() => setCursor('')} {...testId(`${testIdValue}-search`)}/>
          {itemsQuery.isError && <Alert type="error" showIcon title="候选查询失败" description="商品 owner 未返回可验证候选，请重试。" action={<Button size="small" onClick={() => void itemsQuery.refetch()}>重试</Button>} {...testId(`${testIdValue}-error`)}/>} 
          <List loading={itemsQuery.isLoading || itemsQuery.isFetching} dataSource={page.items.filter((item) => item.code !== currentItemCode)} locale={{emptyText: '暂无可引用商品'}} renderItem={(item) => <List.Item actions={[<Button key="select" type="link" onClick={() => { onSelect(item.code); setOpen(false); }} {...testId(`${testIdValue}-select-${item.code}`)}>选择</Button>]}>
            <List.Item.Meta title={<NameCodeText name={item.name} code={item.code}/>} description={`${item.shapeKey} · ${item.status} · ${item.source}`}/>
          </List.Item>}
          />
          {page.cursor && <Button onClick={() => setCursor(page.cursor)} loading={itemsQuery.isFetching} {...testId(`${testIdValue}-next`)}>加载下一页</Button>}
        </Space></Col>
      </Row>
    </Drawer>
  </>;
}

type CategoryTreeNode = {key: string; title: string; children?: CategoryTreeNode[]};
function buildCategoryTree(nodes: ReturnType<typeof decodeNavigation>['tree']): CategoryTreeNode[] {
  const byParent = new Map<string, typeof nodes>();
  nodes.forEach((node) => { const parent = node.parentCode ?? ''; byParent.set(parent, [...(byParent.get(parent) ?? []), node]); });
  const build = (parent: string): CategoryTreeNode[] => (byParent.get(parent) ?? []).map((node) => {
    const children = build(node.code);
    return {key: node.code, title: `${node.label}（${node.count}）`, ...(children.length ? {children} : {})};
  });
  return build('');
}

function CompositeGroupsEditor({values, onChange, onDirty, queryContext, brandRef, currentItemCode}: {values: CatalogCompositeGroup[]; onChange: (next: CatalogCompositeGroup[]) => void; onDirty: () => void; queryContext: OperationsPageProps['queryContext']; brandRef?: string; currentItemCode?: string}) {
  const updateGroup = (index: number, patch: Partial<CatalogCompositeGroup>) => onChange(values.map((group, groupIndex) => groupIndex === index ? {...group, ...patch} : group));
  const updateComponent = (groupIndex: number, componentIndex: number, patch: Partial<CatalogCompositeComponent>) => onChange(values.map((group, index) => index === groupIndex ? {...group, components: group.components.map((component, entryIndex) => entryIndex === componentIndex ? {...component, ...patch} : component)} : group));
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-composite-groups-editor')}>
    <Alert type="info" showIcon title="套餐组件只维护商品 owner 的结构；库存/BOM 提示不在此跨 owner 修改。"/>
    <Button onClick={() => { onChange([...values, {groupCode: '', groupName: '', selectionRule: 'FIXED', components: []}]); onDirty(); }} {...testId('catalog-item-composite-group-add')}>新增套餐分组</Button>
    {values.length === 0 && <EmptySection text="未维护套餐分组"/>}
    {values.map((group, groupIndex) => <Card key={`${group.groupCode}-${groupIndex}`} size="small" title={`套餐分组 ${groupIndex + 1}`} extra={<Button danger type="link" onClick={() => { onChange(values.filter((_, index) => index !== groupIndex)); onDirty(); }} {...testId(`catalog-item-composite-group-remove-${groupIndex}`)}>移除组</Button>}>
      <Space direction="vertical" size={8} style={{display: 'flex'}}>
        <Space wrap>
          <Input addonBefore="组编码" value={group.groupCode} onChange={(event) => { updateGroup(groupIndex, {groupCode: event.target.value}); onDirty(); }} {...testId(`catalog-item-composite-group-code-${groupIndex}`)}/>
          <Input addonBefore="组名" value={group.groupName} onChange={(event) => { updateGroup(groupIndex, {groupName: event.target.value}); onDirty(); }} {...testId(`catalog-item-composite-group-name-${groupIndex}`)}/>
          <Select value={group.selectionRule} options={[{value: 'FIXED', label: '固定包含'}, {value: 'SINGLE', label: '单选'}, {value: 'MULTIPLE', label: '多选'}]} onChange={(selectionRule) => { updateGroup(groupIndex, {selectionRule}); onDirty(); }} {...testId(`catalog-item-composite-group-rule-${groupIndex}`)}/>
        </Space>
        <Button size="small" onClick={() => { updateGroup(groupIndex, {components: [...group.components, {itemCode: '', skuCode: null, quantity: '1', unit: '', default: false, extraPrice: null, status: 'ENABLED'}]}); onDirty(); }} {...testId(`catalog-item-composite-component-add-${groupIndex}`)}>添加组件</Button>
        {group.components.map((component, componentIndex) => <Space key={`${component.itemCode}-${componentIndex}`} wrap>
          <CompositeCandidatePicker value={component.itemCode} currentItemCode={currentItemCode} queryContext={queryContext} brandRef={brandRef} testIdValue={`catalog-item-composite-component-item-${groupIndex}-${componentIndex}`} onSelect={(itemCode) => { updateComponent(groupIndex, componentIndex, {itemCode}); onDirty(); }}/>
          <Input addonBefore="SKU" value={component.skuCode ?? ''} onChange={(event) => { updateComponent(groupIndex, componentIndex, {skuCode: event.target.value || null}); onDirty(); }} {...testId(`catalog-item-composite-component-sku-${groupIndex}-${componentIndex}`)}/>
          <Input addonBefore="数量" value={component.quantity} onChange={(event) => { updateComponent(groupIndex, componentIndex, {quantity: event.target.value}); onDirty(); }} {...testId(`catalog-item-composite-component-quantity-${groupIndex}-${componentIndex}`)}/>
          <Input addonBefore="单位" value={component.unit} onChange={(event) => { updateComponent(groupIndex, componentIndex, {unit: event.target.value}); onDirty(); }} {...testId(`catalog-item-composite-component-unit-${groupIndex}-${componentIndex}`)}/>
          <InputNumber addonBefore="加价（分）" value={component.extraPrice} min={0} precision={0} onChange={(extraPrice) => { updateComponent(groupIndex, componentIndex, {extraPrice: extraPrice ?? null}); onDirty(); }} {...testId(`catalog-item-composite-component-price-${groupIndex}-${componentIndex}`)}/>
          <Select value={component.status} options={[{value: 'ENABLED', label: '启用'}, {value: 'DISABLED', label: '停用'}]} onChange={(status) => { updateComponent(groupIndex, componentIndex, {status}); onDirty(); }} {...testId(`catalog-item-composite-component-status-${groupIndex}-${componentIndex}`)}/>
          <Space><Typography.Text>默认</Typography.Text><Switch checked={component.default} onChange={(defaultValue) => { updateComponent(groupIndex, componentIndex, {default: defaultValue}); onDirty(); }} {...testId(`catalog-item-composite-component-default-${groupIndex}-${componentIndex}`)}/></Space>
          <Button danger type="link" onClick={() => { updateGroup(groupIndex, {components: group.components.filter((_, index) => index !== componentIndex)}); onDirty(); }} {...testId(`catalog-item-composite-component-remove-${groupIndex}-${componentIndex}`)}>移除</Button>
        </Space>)}
      </Space>
    </Card>)}
  </Space>;
}

function CompositeGroupsReadOnly({values}: {values: CatalogCompositeGroup[]}) {
  if (!values.length) return <EmptySection text="未维护套餐分组"/>;
  return <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-item-composite-groups-readonly')}>
    {values.map((group) => <Card key={group.groupCode || group.groupName} size="small" title={<Space><Typography.Text strong>{group.groupName || '未命名分组'}</Typography.Text><Typography.Text type="secondary">{group.groupCode || '—'}</Typography.Text></Space>}>
      <Descriptions size="small" column={1} items={[{key: 'rule', label: '选择规则', children: group.selectionRule || '—'}, {key: 'components', label: '组件', children: group.components.length ? <Space direction="vertical" size={2}>{group.components.map((component, index) => <Typography.Text key={`${component.itemCode}-${index}`}>{component.itemCode || '—'}{component.skuCode ? ` / ${component.skuCode}` : ''} · {component.quantity} {component.unit} · {component.default ? '默认' : '可选'} · {money(component.extraPrice)} · {component.status || '—'}</Typography.Text>)}</Space> : '未添加组件'}]}/>
    </Card>)}
  </Space>;
}

function CatalogAssetEditor({mediaDraft, onStageMedia, onRemoveMedia, onMoveMedia, onSetPrimaryMedia}: {mediaDraft: MediaDraft[]; onStageMedia: (file: File, existingId?: string) => Promise<void>; onRemoveMedia: (id: string, index: number) => void | Promise<void>; onMoveMedia: (id: string, offset: -1 | 1) => void; onSetPrimaryMedia: (id: string) => void}) {
  return <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-media-editor')}>
    <Space style={{width: '100%', justifyContent: 'space-between'}}>
      <Typography.Text strong>商品图片</Typography.Text>
      <Typography.Text type="secondary">{mediaDraft.length}/{MAX_MEDIA_COUNT}（1 张主图 + 5 张附图） · 单张上限 2MB</Typography.Text>
    </Space>
    <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => { void onStageMedia(file as File); return Upload.LIST_IGNORE; }} disabled={mediaDraft.length >= MAX_MEDIA_COUNT} {...testId('catalog-item-media-upload')}>
      <Button disabled={mediaDraft.length >= MAX_MEDIA_COUNT}>{mediaDraft.length >= MAX_MEDIA_COUNT ? '已达图片上限' : '上传图片'}</Button>
    </Upload>
    <Space direction="vertical" size={8} style={{display: 'flex'}} {...testId('catalog-item-media-list')}>
      {mediaDraft.length === 0 && <EmptySection text="未配置图片"/>}
      {mediaDraft.map((asset, index) => <Space key={asset.id} align="start" style={{display: 'flex', border: '1px solid #f0f0f0', padding: 8, borderRadius: 6}} {...testId(`catalog-item-media-${index}`)}>
        <Space direction="vertical" size={2} style={{minWidth: 220}}>
          <Typography.Text strong>{index === 0 ? '★ 主图' : `附图 ${index}`}</Typography.Text>
          <Typography.Text ellipsis={{tooltip: asset.fileName}}>{asset.fileName}</Typography.Text>
          <Typography.Text type={asset.status === 'FAILED' ? 'danger' : asset.status === 'UPLOADING' ? 'warning' : 'secondary'} {...testId(`catalog-item-media-status-${index}`)}>{asset.status === 'UPLOADING' ? '上传中/处理中' : asset.status === 'FAILED' ? asset.error ?? '上传失败' : asset.assetRef ? '可用' : '待上传'}</Typography.Text>
        </Space>
        <Space wrap>
          <Upload accept="image/*" showUploadList={false} beforeUpload={(file) => { void onStageMedia(file as File, asset.id); return Upload.LIST_IGNORE; }} disabled={asset.status === 'UPLOADING'}>
            <Button size="small" disabled={asset.status === 'UPLOADING'} {...testId(`catalog-item-media-replace-${index}`)}>替换</Button>
          </Upload>
          {asset.status === 'FAILED' && asset.file && <Button size="small" onClick={() => void onStageMedia(asset.file as File, asset.id)} {...testId(`catalog-item-media-retry-${index}`)}>重试</Button>}
          {index > 0 && <Button size="small" onClick={() => onMoveMedia(asset.id, -1)} {...testId(`catalog-item-media-move-up-${index}`)}>上移</Button>}
          {index < mediaDraft.length - 1 && <Button size="small" onClick={() => onMoveMedia(asset.id, 1)} {...testId(`catalog-item-media-move-down-${index}`)}>下移</Button>}
          {index > 0 && <Button size="small" onClick={() => onSetPrimaryMedia(asset.id)} {...testId(`catalog-item-media-set-primary-${index}`)}>设为主图</Button>}
          <Button size="small" danger disabled={index === 0 && mediaDraft.length > 1} onClick={() => void onRemoveMedia(asset.id, index)} {...testId(`catalog-item-media-remove-${index}`)}>移除</Button>
        </Space>
      </Space>)}
    </Space>
  </Space>;
}

function CatalogAssetGallery({assetRefs}: {assetRefs: string[]}) {
  return <Space direction="vertical" size={4} {...testId('catalog-item-media-gallery')}>
    {assetRefs.length ? assetRefs.map((assetRef, index) => <Typography.Text key={`${assetRef}-${index}`}>{index === 0 ? '主图' : `附图 ${index}`}：{assetRef}</Typography.Text>) : '未配置图片'}
  </Space>;
}

function EmptySection({text}: {text: string}) { return <Typography.Text type="secondary">{displayValue(text as JsonValue)}</Typography.Text>; }
function money(value: number | null) { return value === null ? '—' : `¥${(value / 100).toFixed(2)}`; }
function FactMap({value, empty}: {value: Record<string, JsonValue>; empty: string}) { const entries = Object.entries(value); return entries.length ? <Descriptions {...adminWideDetailDescriptionsProps} items={entries.map(([key, entry]) => ({key, label: key, children: displayValue(entry)}))}/> : <EmptySection text={empty}/>; }
