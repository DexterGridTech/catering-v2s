import {Alert, Button, Card, Space, Table, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useMemo, useState, type ReactNode} from 'react';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogUnitList} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogDetail, CatalogIdentifierType, CatalogSkuRow} from '../model/catalogModel';
import {buildSkuMatrix} from '../model/catalogModel';
import {
  type MediaDraft,
  type PreparationProfileDraft,
  type SkuDimensionDraft,
  type SkuRowDraft,
} from '../model/catalogItemEditorDraftAdapters';
import type {CatalogCandidateRow, CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';
import {
  reconcileSkuDimensionValuesFromSelection,
  reconcileSkuDimensionsFromSelection,
} from '../model/catalogSkuSpecificationDraft';
import {CatalogDescriptorPicker} from './CatalogDescriptorPicker';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {SkuIdentifierEditorModal} from './CatalogItemIdentifiersEditor';
import {SkuPreparationEditorModal} from './CatalogItemProductionEditor';
import {EmptySection, SkuMatrixReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionEditor, CatalogFactSectionView} from './CatalogFactSectionBoundary';
import {CatalogItemSkuMatrixTable} from './CatalogItemSkuMatrixTable';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';

type CatalogUnitOption = CatalogUnitList['data']['units'][number];

type SkuSpecificationsProps = {
  mode: 'view' | 'edit';
  manifest?: CatalogManifest;
  dimensions: SkuDimensionDraft[];
  skus: SkuRowDraft[];
  readOnlyDimensions: CatalogDetail['item']['skuVariantDimensions'];
  readOnlySkus: CatalogDetail['item']['skus'];
  readOnlySummary: CatalogDetail['item']['skuSummary'];
  priceGranularity: string;
  itemLifecycleStatus?: string;
  standardSalePrice?: number | null;
  allowedIdentifierTypes: CatalogIdentifierType[];
  itemDefaultPreparation: PreparationProfileDraft | null;
  skuStagedMedia: MediaDraft[];
  scopeRef?: string;
  brandRef?: string;
  version: number;
  unitOptions: CatalogUnitOption[];
  onOpenDictionary?: (kind: 'SKU_ATTRIBUTE', triggerTestId: string) => void;
  onDimensionsChange: (next: SkuDimensionDraft[]) => void;
  onSkusChange: (next: CatalogSkuRow[]) => void;
  onStageSkuMedia: (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuEditorId: string, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  canWriteCatalog: boolean;
  lockNotices?: ReactNode;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
  onDirty: () => void;
  createDraftRowId: (prefix: string) => string;
};

export function CatalogItemSkuSpecificationsEditor(props: SkuSpecificationsProps) {
  if (props.mode === 'view') {
    return (
      <CatalogFactSectionView section="sku-specifications-pricing">
        <Space direction="vertical" style={{display: 'flex'}}>
          {props.lockNotices}
          <SkuMatrixReadOnly
            manifest={props.manifest}
            dimensions={props.readOnlyDimensions}
            skus={props.readOnlySkus}
            summary={props.readOnlySummary}
            priceGranularity={props.priceGranularity}
            standardSalePrice={props.standardSalePrice}
            canWriteCatalog={props.canWriteCatalog}
            itemStatus={props.itemLifecycleStatus}
            onVoidSku={props.onVoidSku}
            voidingSkuRef={props.voidingSkuRef}
          />
        </Space>
      </CatalogFactSectionView>
    );
  }
  return (
    <CatalogFactSectionEditor section="sku-specifications-pricing">
      <SkuMatrixEditor {...props} />
    </CatalogFactSectionEditor>
  );
}

function SkuMatrixEditor({
  manifest,
  dimensions,
  skus,
  allowedIdentifierTypes,
  itemDefaultPreparation,
  priceGranularity,
  skuStagedMedia,
  scopeRef,
  brandRef,
  version,
  unitOptions,
  onOpenDictionary,
  onDimensionsChange,
  onSkusChange,
  onStageSkuMedia,
  onRemoveSkuMedia,
  onRemoveSkuStagedMedia,
  canWriteCatalog,
  onVoidSku,
  voidingSkuRef,
  onDirty,
  createDraftRowId,
}: {
  manifest?: CatalogManifest;
  dimensions: SkuDimensionDraft[];
  skus: SkuRowDraft[];
  allowedIdentifierTypes: CatalogIdentifierType[];
  itemDefaultPreparation: PreparationProfileDraft | null;
  priceGranularity: string;
  skuStagedMedia: MediaDraft[];
  scopeRef?: string;
  brandRef?: string;
  version: number;
  unitOptions: CatalogUnitOption[];
  onOpenDictionary?: (kind: 'SKU_ATTRIBUTE', triggerTestId: string) => void;
  onDimensionsChange: (next: SkuDimensionDraft[]) => void;
  onSkusChange: (next: CatalogSkuRow[]) => void;
  onStageSkuMedia: (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuEditorId: string, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  canWriteCatalog: boolean;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
  onDirty: () => void;
  createDraftRowId: (prefix: string) => string;
}) {
  const [identifierModalEditorId, setIdentifierModalEditorId] = useState<string>();
  const [preparationModalEditorId, setPreparationModalEditorId] = useState<string>();
  const attributePickerContext = useMemo<CatalogFieldRuntimeContext>(
    () => ({
      scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
      readField: () => undefined,
      readSection: () => [],
      sectionRevision: () => version,
    }),
    [brandRef, scopeRef, version],
  );
  const valuePickerContexts = useMemo(
    () =>
      new Map(
        dimensions.map(dimension => [
          dimension.editorId,
          {
            scope: {dataNodeRef: wireUuid(scopeRef ?? ''), brandRef},
            readField: (fieldKey: string) => (fieldKey === 'skuVariantAttribute' ? dimension.attributeRef : undefined),
            readSection: () => [],
            sectionRevision: () => `${version}:${dimension.attributeRef}`,
          } satisfies CatalogFieldRuntimeContext,
        ]),
      ),
    [brandRef, dimensions, scopeRef, version],
  );
  const applyDimensions = (next: SkuDimensionDraft[]) => {
    const normalized = next.map(dimension => ({
      ...dimension,
      values: dimension.values.map((value, index) => ({...value, displayOrder: index})),
    }));
    onDimensionsChange(normalized);
    onSkusChange(buildSkuMatrix(normalized, skus));
    onDirty();
  };
  const handleAttributeSelection = (next: string | string[], rawRows?: CatalogCandidateRow | CatalogCandidateRow[]) => {
    const nextAttributeRefs = Array.isArray(next) ? next : next ? [next] : [];
    const rows = rawRows ? (Array.isArray(rawRows) ? rawRows : [rawRows]) : [];
    applyDimensions(reconcileSkuDimensionsFromSelection(dimensions, nextAttributeRefs, rows, createDraftRowId));
  };
  const handleDimensionValuesSelection = (
    dimension: SkuDimensionDraft,
    next: string | string[],
    rawRows?: CatalogCandidateRow | CatalogCandidateRow[],
  ) => {
    const nextValueRefs = Array.isArray(next) ? next : next ? [next] : [];
    const rows = rawRows ? (Array.isArray(rawRows) ? rawRows : [rawRows]) : [];
    const values = reconcileSkuDimensionValuesFromSelection(dimension.values, nextValueRefs, rows, createDraftRowId);
    applyDimensions(dimensions.map(entry => (entry.editorId === dimension.editorId ? {...entry, values} : entry)));
  };
  const updateSku = (editorId: string, patch: Partial<SkuRowDraft>) =>
    onSkusChange(skus.map(entry => (entry.editorId === editorId ? {...entry, ...patch} : entry)));
  const dimensionColumns: ColumnsType<SkuDimensionDraft> = [
    {
      title: '规格属性',
      width: 220,
      render: (_value, dimension) => (
        <Space direction="vertical" size={0} style={{display: 'flex'}}>
          <Typography.Text>{dimension.attributeName || '未命名规格属性'}</Typography.Text>
          {dimension.attributeCode && (
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              {dimension.attributeCode}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '可选值',
      render: (_value, dimension) => (
        <CatalogDescriptorPicker
          manifest={manifest}
          shapeKey="SKU_VARIANT_SALE_COUNTED"
          fieldKey="skuVariantValues"
          value={dimension.values.map(value => String(value.valueRef)).filter(Boolean)}
          context={valuePickerContexts.get(dimension.editorId)!}
          disabled={!dimension.attributeRef}
          disabledMessage={!dimension.attributeRef ? '请先从上方选择规格属性。' : undefined}
          hideLabel
          testIdValue={catalogTestIdControls.edit.dynamic('sku-dimension', 'values', dimension.editorId)}
          width="100%"
          onChange={(next, rawRows) => handleDimensionValuesSelection(dimension, next, rawRows)}
        />
      ),
    },
  ];
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemSkuMatrixEditor)}
    >
      <Alert
        type="info"
        showIcon
        title="选择规格属性和可选值后，规格组合会自动生成；再逐项补充名称、价格、单位和制作信息。"
      />
      <Card size="small" title="1. 选择规格属性和可选值">
        <Space direction="vertical" size={10} style={{display: 'flex'}}>
          <CatalogDescriptorPicker
            manifest={manifest}
            shapeKey="SKU_VARIANT_SALE_COUNTED"
            fieldKey="skuVariantAttribute"
            value={dimensions.map(dimension => String(dimension.attributeRef)).filter(Boolean)}
            context={attributePickerContext}
            actions={
              onOpenDictionary ? (
                <Button
                  size="small"
                  onClick={() => onOpenDictionary('SKU_ATTRIBUTE', catalogTestIds.static.itemSkuAttributeManage)}
                  {...testId(catalogTestIds.static.itemSkuAttributeManage)}
                >
                  维护规格属性
                </Button>
              ) : undefined
            }
            actionsPlacement="after-label"
            testIdValue={catalogTestIds.static.itemSkuAttributeSelector}
            width="100%"
            onChange={handleAttributeSelection}
          />
          {dimensions.length === 0 ? (
            <EmptySection text="请从规格库选择规格属性。" />
          ) : (
            <Table<SkuDimensionDraft>
              size="small"
              tableLayout="fixed"
              pagination={false}
              rowKey="editorId"
              columns={dimensionColumns}
              dataSource={dimensions}
              scroll={{x: 700}}
              {...testId(catalogTestIds.static.itemSkuDimensionTable)}
            />
          )}
        </Space>
      </Card>
      <CatalogItemSkuMatrixTable
        manifest={manifest}
        dimensions={dimensions}
        skus={skus}
        priceGranularity={priceGranularity}
        unitOptions={unitOptions}
        skuStagedMedia={skuStagedMedia}
        canWriteCatalog={canWriteCatalog}
        voidingSkuRef={voidingSkuRef}
        onUpdateSku={updateSku}
        onOpenIdentifiers={setIdentifierModalEditorId}
        onOpenPreparation={setPreparationModalEditorId}
        onVoidSku={onVoidSku}
        onRemoveSku={editorId => onSkusChange(skus.filter(entry => entry.editorId !== editorId))}
        onStageSkuMedia={onStageSkuMedia}
        onRemoveSkuMedia={onRemoveSkuMedia}
        onRemoveSkuStagedMedia={onRemoveSkuStagedMedia}
        onDirty={onDirty}
      />
      <SkuIdentifierEditorModal
        open={identifierModalEditorId !== undefined}
        sku={
          identifierModalEditorId === undefined ? undefined : skus.find(sku => sku.editorId === identifierModalEditorId)
        }
        allowedTypes={allowedIdentifierTypes}
        onCancel={() => setIdentifierModalEditorId(undefined)}
        onConfirm={identifiers => {
          if (identifierModalEditorId === undefined) return;
          updateSku(identifierModalEditorId, {identifiers});
          onDirty();
          setIdentifierModalEditorId(undefined);
        }}
      />
      <SkuPreparationEditorModal
        open={preparationModalEditorId !== undefined}
        sku={
          preparationModalEditorId === undefined
            ? undefined
            : skus.find(sku => sku.editorId === preparationModalEditorId)
        }
        itemDefaultPreparation={itemDefaultPreparation}
        onCancel={() => setPreparationModalEditorId(undefined)}
        onConfirm={preparationOverride => {
          if (preparationModalEditorId === undefined) return;
          updateSku(preparationModalEditorId, {preparationOverride});
          onDirty();
          setPreparationModalEditorId(undefined);
        }}
      />
    </Space>
  );
}
