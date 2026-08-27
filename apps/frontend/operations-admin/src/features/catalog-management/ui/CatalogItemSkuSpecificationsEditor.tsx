import {Alert, Button, Card, Divider, Input, Select, Space, Typography} from 'antd';
import {useMemo, useState, type ReactNode} from 'react';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogUnitList} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogDetail, CatalogIdentifierType, CatalogSkuRow} from '../model/catalogModel';
import {buildSkuMatrix} from '../model/catalogModel';
import {
  draftUuid,
  type MediaDraft,
  type PreparationProfileDraft,
  type SkuDimensionDraft,
  type SkuDimensionValueDraft,
  type SkuRowDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {catalogEnumOptions} from '../model/catalogManifestLabels';
import type {CatalogCandidateRow, CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';
import {CatalogDescriptorPicker} from './CatalogDescriptorPicker';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {SkuIdentifierEditorModal} from './CatalogItemIdentifiersEditor';
import {SkuPreparationEditorModal} from './CatalogItemProductionEditor';
import {EmptySection, SkuMatrixReadOnly} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionEditor, CatalogFactSectionView} from './CatalogFactSectionBoundary';
import {CatalogItemSkuMatrixTable} from './CatalogItemSkuMatrixTable';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogFieldWidths} from './catalogFieldWidths';

type CatalogUnitOption = CatalogUnitList['data']['units'][number];

function descriptorString(value: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function descriptorRow(value: CatalogCandidateRow | CatalogCandidateRow[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
  onOpenDictionary?: (kind: 'SKU_ATTRIBUTE') => void;
  onOpenValueDictionary?: (dimensionId: string, valueId: string) => void;
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
  onOpenDictionary?: (kind: 'SKU_ATTRIBUTE') => void;
  onOpenValueDictionary?: (dimensionId: string, valueId: string) => void;
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
  const updateDimension = (editorId: string, patch: Partial<SkuDimensionDraft>) =>
    applyDimensions(dimensions.map(entry => (entry.editorId === editorId ? {...entry, ...patch} : entry)));
  const updateDimensionValue = (dimensionId: string, valueId: string, patch: Partial<SkuDimensionValueDraft>) =>
    applyDimensions(
      dimensions.map(entry =>
        entry.editorId === dimensionId
          ? {
              ...entry,
              values: entry.values.map(value => (value.editorId === valueId ? {...value, ...patch} : value)),
            }
          : entry,
      ),
    );
  const moveDimensionValue = (dimensionId: string, valueId: string, offset: -1 | 1) =>
    applyDimensions(
      dimensions.map(dimension => {
        if (dimension.editorId !== dimensionId) return dimension;
        const index = dimension.values.findIndex(value => value.editorId === valueId);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= dimension.values.length) return dimension;
        const values = [...dimension.values];
        [values[index], values[target]] = [values[target], values[index]];
        return {...dimension, values};
      }),
    );
  const updateSku = (editorId: string, patch: Partial<SkuRowDraft>) =>
    onSkusChange(skus.map(entry => (entry.editorId === editorId ? {...entry, ...patch} : entry)));
  const regenerateMatrix = () => {
    onSkusChange(buildSkuMatrix(dimensions, skus));
    onDirty();
  };
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
        title="先选择规格属性和可选值，再生成规格；生成后可逐项补充名称、价格、单位和制作信息。"
      />
      <Card
        size="small"
        title="1. 选择规格属性和可选值"
        extra={
          <Space>
            <Button
              size="small"
              disabled={dimensions.length === 0}
              onClick={regenerateMatrix}
              {...testId(catalogTestIds.static.itemSkuMatrixRegenerate)}
            >
              生成规格
            </Button>
            <Button
              size="small"
              onClick={() =>
                applyDimensions([
                  ...dimensions,
                  {
                    editorId: createDraftRowId('dimension'),
                    attributeRef: draftUuid(),
                    attributeCode: '',
                    attributeName: '',
                    values: [],
                  },
                ])
              }
              {...testId(catalogTestIds.static.itemSkuDimensionAdd)}
            >
              添加规格属性
            </Button>
          </Space>
        }
      >
        {dimensions.length === 0 && <EmptySection text="未维护规格维度" />}
        <Space direction="vertical" size={10} style={{display: 'flex'}}>
          {dimensions.map((dimension, dimensionIndex) => (
            <Card
              key={dimension.editorId}
              size="small"
              title={dimension.attributeName || `规格属性 ${dimensionIndex + 1}`}
              extra={
                <Button
                  danger
                  type="link"
                  onClick={() => applyDimensions(dimensions.filter(entry => entry.editorId !== dimension.editorId))}
                  {...testId(catalogTestIdControls.edit.dynamic('sku-dimension', 'remove', dimension.editorId))}
                >
                  移除
                </Button>
              }
            >
              <Typography.Text strong>规格属性</Typography.Text>
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
                      {...testId(
                        catalogTestIdControls.edit.dynamic('sku-dimension-attribute', 'manage', dimension.editorId),
                      )}
                    >
                      维护规格属性
                    </Button>
                  )
                }
                testIdValue={catalogTestIdControls.edit.dynamic('sku-dimension', 'attribute', dimension.editorId)}
                width={catalogFieldWidths.regular}
                onChange={(next, rawRow) => {
                  const row = descriptorRow(rawRow);
                  updateDimension(dimension.editorId, {
                    attributeRef: draftUuid(descriptorString(next)),
                    attributeCode: typeof row?.code === 'string' ? row.code : '',
                    attributeName: typeof row?.name === 'string' ? row.name : '',
                    values: [],
                  });
                }}
              />
              <Divider plain style={{margin: '12px 0 8px'}}>
                可选值
              </Divider>
              <Typography.Text type="secondary">
                选择会参与生成规格的属性值；可用上移、下移调整顾客看到的顺序。
              </Typography.Text>
              <Button
                size="small"
                disabled={!dimension.attributeRef}
                onClick={() =>
                  updateDimension(dimension.editorId, {
                    values: [
                      ...dimension.values,
                      {
                        valueRef: draftUuid(),
                        editorId: createDraftRowId('dimension-value'),
                        valueCode: '',
                        valueLabel: '',
                        displayOrder: dimension.values.length,
                        status: 'ENABLED',
                      },
                    ],
                  })
                }
                {...testId(catalogTestIdControls.edit.dynamic('sku-dimension-value', 'add', dimension.editorId))}
              >
                添加可选值
              </Button>
              <Space direction="vertical" size={6} style={{display: 'flex', marginTop: 8}}>
                {dimension.values.map((value, valueIndex) => (
                  <Space key={value.editorId} wrap align="end" style={{display: 'flex'}}>
                    <CatalogDescriptorPicker
                      manifest={manifest}
                      shapeKey="SKU_VARIANT_SALE_COUNTED"
                      fieldKey="skuVariantValues"
                      value={String(value.valueRef ?? '')}
                      context={valuePickerContexts.get(dimension.editorId)!}
                      disabled={!dimension.attributeRef}
                      disabledMessage={!dimension.attributeRef ? '请先选择规格属性，再选择属性值。' : undefined}
                      actions={
                        onOpenValueDictionary && (
                          <Button
                            size="small"
                            disabled={!dimension.attributeRef}
                            onClick={() => onOpenValueDictionary(dimension.editorId, value.editorId)}
                            {...testId(
                              catalogTestIdControls.edit.dynamic(
                                'sku-dimension-value',
                                'manage',
                                dimension.editorId,
                                value.editorId,
                              ),
                            )}
                          >
                            维护属性值
                          </Button>
                        )
                      }
                      testIdValue={catalogTestIdControls.edit.dynamic(
                        'sku-dimension',
                        'value',
                        dimension.editorId,
                        value.editorId,
                      )}
                      width={catalogFieldWidths.full}
                      onChange={(next, rawRow) => {
                        const row = descriptorRow(rawRow);
                        updateDimensionValue(dimension.editorId, value.editorId, {
                          valueRef: draftUuid(descriptorString(next)),
                          valueCode: typeof row?.code === 'string' ? row.code : '',
                          valueLabel: typeof row?.name === 'string' ? row.name : '',
                          status: typeof row?.status === 'string' ? row.status : 'ENABLED',
                        });
                        onDirty();
                      }}
                    />
                    <Space size={2}>
                      <Button
                        size="small"
                        disabled={valueIndex === 0}
                        onClick={() => moveDimensionValue(dimension.editorId, value.editorId, -1)}
                        {...testId(
                          catalogTestIdControls.edit.dynamic(
                            'sku-dimension-value',
                            'move-up',
                            dimension.editorId,
                            value.editorId,
                          ),
                        )}
                      >
                        上移
                      </Button>
                      <Button
                        size="small"
                        disabled={valueIndex === dimension.values.length - 1}
                        onClick={() => moveDimensionValue(dimension.editorId, value.editorId, 1)}
                        {...testId(
                          catalogTestIdControls.edit.dynamic(
                            'sku-dimension-value',
                            'move-down',
                            dimension.editorId,
                            value.editorId,
                          ),
                        )}
                      >
                        下移
                      </Button>
                    </Space>
                    <Select
                      style={{width: catalogFieldWidths.compact}}
                      value={value.status}
                      options={catalogEnumOptions(manifest, 'skuStatus')}
                      onChange={status => {
                        updateDimensionValue(dimension.editorId, value.editorId, {status});
                        onDirty();
                      }}
                      {...testId(
                        catalogTestIdControls.edit.dynamic(
                          'sku-dimension-value',
                          'status',
                          dimension.editorId,
                          value.editorId,
                        ),
                      )}
                    />
                    <Button
                      danger
                      type="link"
                      onClick={() => {
                        updateDimension(dimension.editorId, {
                          values: dimension.values.filter(entry => entry.editorId !== value.editorId),
                        });
                        onDirty();
                      }}
                      {...testId(
                        catalogTestIdControls.edit.dynamic(
                          'sku-dimension-value',
                          'remove',
                          dimension.editorId,
                          value.editorId,
                        ),
                      )}
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
