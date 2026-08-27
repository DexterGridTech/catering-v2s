import {Button, Input, InputNumber, Select, Space, Switch, Table, Tag, Tooltip, Typography, Upload} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {CatalogUnitList, Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogSkuRow} from '../model/catalogModel';
import {catalogCentsToYuan, catalogSkuIssueCodes, catalogYuanToCents} from '../model/catalogModel';
import type {
  MediaDraft,
  PreparationProfileDraft,
  SkuDimensionDraft,
  SkuRowDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {catalogEnumOptions, catalogFieldLabel} from '../model/catalogManifestLabels';
import {CatalogAssetPreview} from './CatalogAssetPreview';
import {catalogVoidBlockReason} from './CatalogItemEditorFieldPresentation';
import {catalogTestIdControls} from '../catalogTestIds';
import {testId} from '@catering-v2s/admin-ui-foundation';

type CatalogUnitOption = CatalogUnitList['data']['units'][number];
type CatalogManifest = Pick<CatalogShapeManifestView, 'enumLabels' | 'fields' | 'fieldRules' | 'tabRules'>;
type SkuDraftIssueCode = ReturnType<typeof catalogSkuIssueCodes>[number];

const skuIssueLabels: Record<SkuDraftIssueCode, string> = {
  MISSING_CODE: '缺少规格编码',
  MISSING_NAME: '缺少规格名称',
  DUPLICATE_CODE: '规格编码重复',
  DUPLICATE_COMBINATION: '属性组合重复',
};

function combinationKey(sku: SkuRowDraft) {
  return sku.attributeValueRefs
    .map(value => `${value.attributeRef}:${value.attributeValueRef}`)
    .sort()
    .join('|');
}

function UnitOverrideSelect({
  label,
  value,
  current,
  units,
  onChange,
}: {
  label: string;
  value: Uuid | null;
  current?: {unitRef: Uuid; name: string; code: string};
  units: CatalogUnitOption[];
  onChange: (value: Uuid | null) => void;
}) {
  const options = new Map(units.map(unit => [unit.unitRef, unit]));
  if (current && !options.has(current.unitRef))
    options.set(current.unitRef, {
      ...current,
      unitDimension: 'COUNT' as const,
      precision: 0,
      status: 'DISABLED' as const,
      isReferenced: false,
      version: 0,
    });
  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={label}
      value={value ?? undefined}
      style={{width: '100%'}}
      options={[...options.values()].map(unit => ({value: unit.unitRef, label: unit.name}))}
      onChange={next => onChange(next ?? null)}
    />
  );
}

function SkuMediaCell({
  sku,
  skuStagedMedia,
  onStage,
  onRemove,
  onRemoveStaged,
  onDirty,
}: {
  sku: SkuRowDraft;
  skuStagedMedia: MediaDraft[];
  onStage: (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemove: (skuEditorId: string, assetRef: string) => Promise<void>;
  onRemoveStaged: (id: string) => void;
  onDirty: () => void;
}) {
  const pending = skuStagedMedia.filter(asset => asset.skuEditorId === sku.editorId && asset.status !== 'READY');
  return (
    <Space direction="vertical" size={4} style={{display: 'flex'}}>
      <Space wrap size={4}>
        {sku.mediaRefs.map(assetRef => (
          <span key={assetRef} style={{position: 'relative', display: 'inline-flex'}}>
            <CatalogAssetPreview
              assetRef={assetRef}
              alt={`${sku.skuName || '规格'}图片`}
              width={40}
              height={40}
              testId={catalogTestIdControls.edit.skuMedia(sku.editorId, assetRef, 'preview')}
            />
            <Button
              danger
              size="small"
              type="link"
              aria-label="移除规格图片"
              onClick={() => void onRemove(sku.editorId, assetRef)}
              {...testId(catalogTestIdControls.edit.skuMedia(sku.editorId, assetRef, 'remove'))}
            >
              移除
            </Button>
          </span>
        ))}
      </Space>
      {pending.map(stagedAsset => (
        <Space key={stagedAsset.id} size={4}>
          {stagedAsset.file && (
            <CatalogAssetPreview
              localFile={stagedAsset.file}
              alt={`${sku.skuName || '规格'}待上传图片`}
              width={40}
              height={40}
              testId={catalogTestIdControls.edit.skuMedia(sku.editorId, stagedAsset.id, 'staged-preview')}
            />
          )}
          <Typography.Text
            type={stagedAsset.status === 'FAILED' ? 'danger' : 'secondary'}
            ellipsis={{tooltip: stagedAsset.fileName}}
          >
            {stagedAsset.status === 'FAILED' ? (stagedAsset.error ?? '图片上传失败') : '待上传图片'}
          </Typography.Text>
          {stagedAsset.status === 'FAILED' && stagedAsset.file && (
            <Button
              size="small"
              onClick={() =>
                void onStage(stagedAsset.file as File, sku.editorId, stagedAsset.previous?.assetRef, stagedAsset.id)
              }
            >
              重试
            </Button>
          )}
          <Button
            size="small"
            danger
            disabled={stagedAsset.status === 'UPLOADING'}
            onClick={() => onRemoveStaged(stagedAsset.id)}
          >
            移除
          </Button>
        </Space>
      ))}
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={file => {
          void onStage(file as File, sku.editorId);
          onDirty();
          return Upload.LIST_IGNORE;
        }}
      >
        <Button size="small" {...testId(catalogTestIdControls.edit.dynamic('sku-media', 'upload', sku.editorId))}>
          上传图片
        </Button>
      </Upload>
    </Space>
  );
}

export function CatalogItemSkuMatrixTable({
  manifest,
  dimensions,
  skus,
  priceGranularity,
  unitOptions,
  skuStagedMedia,
  canWriteCatalog,
  voidingSkuRef,
  onUpdateSku,
  onOpenIdentifiers,
  onOpenPreparation,
  onVoidSku,
  onRemoveSku,
  onStageSkuMedia,
  onRemoveSkuMedia,
  onRemoveSkuStagedMedia,
  onDirty,
}: {
  manifest?: CatalogManifest;
  dimensions: SkuDimensionDraft[];
  skus: SkuRowDraft[];
  priceGranularity: string;
  unitOptions: CatalogUnitOption[];
  skuStagedMedia: MediaDraft[];
  canWriteCatalog: boolean;
  voidingSkuRef?: string;
  onUpdateSku: (editorId: string, patch: Partial<SkuRowDraft>) => void;
  onOpenIdentifiers: (editorId: string) => void;
  onOpenPreparation: (editorId: string) => void;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  onRemoveSku: (editorId: string) => void;
  onStageSkuMedia: (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuEditorId: string, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  onDirty: () => void;
}) {
  const combinationCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  skus.forEach(sku => {
    const combination = combinationKey(sku);
    combinationCounts.set(combination, (combinationCounts.get(combination) ?? 0) + 1);
    const code = sku.skuCode.trim();
    if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  });
  const columns: ColumnsType<SkuRowDraft> = [
    ...dimensions.map(dimension => ({
      title: dimension.attributeName || '规格属性',
      width: 160,
      render: (_value: unknown, sku: SkuRowDraft) => {
        const value = sku.attributeValueRefs.find(entry => entry.attributeRef === dimension.attributeRef);
        return (
          <Typography.Text ellipsis={{tooltip: value?.valueLabel ?? '未选择'}}>
            {value?.valueLabel || '未选择'}
          </Typography.Text>
        );
      },
    })),
    {
      title: '规格名称',
      width: 200,
      render: (_value, sku) => (
        <Input
          aria-label="规格名称"
          value={sku.skuName}
          status={!sku.skuName.trim() ? 'error' : undefined}
          onChange={event => {
            onUpdateSku(sku.editorId, {skuName: event.target.value});
            onDirty();
          }}
          {...testId(catalogTestIdControls.edit.dynamic('sku', 'name', sku.editorId))}
        />
      ),
    },
    {
      title: '规格编码',
      width: 180,
      render: (_value, sku) => (
        <Input
          aria-label="规格编码"
          value={sku.skuCode}
          disabled={Boolean(sku.productSkuRef)}
          status={!sku.skuCode.trim() || (codeCounts.get(sku.skuCode.trim()) ?? 0) > 1 ? 'error' : undefined}
          onChange={event => {
            onUpdateSku(sku.editorId, {skuCode: event.target.value});
            onDirty();
          }}
          {...testId(catalogTestIdControls.edit.dynamic('sku', 'code', sku.editorId))}
        />
      ),
    },
    {
      title: '标准价（元）',
      width: 160,
      render: (_value, sku) => (
        <InputNumber
          aria-label="标准价（元）"
          style={{width: '100%'}}
          min={0}
          precision={2}
          step={0.01}
          value={catalogCentsToYuan(sku.standardSalePrice)}
          onChange={standardSalePrice => {
            onUpdateSku(sku.editorId, {standardSalePrice: catalogYuanToCents(standardSalePrice)});
            onDirty();
          }}
          {...testId(catalogTestIdControls.edit.dynamic('sku', 'price', sku.editorId))}
        />
      ),
    },
    {
      title: '销售单位',
      width: 180,
      render: (_value, sku) => (
        <UnitOverrideSelect
          label="继承商品销售单位"
          value={sku.salesUnitOverrideRef}
          current={sku.salesUnit ?? undefined}
          units={unitOptions}
          onChange={salesUnitOverrideRef => {
            onUpdateSku(sku.editorId, {salesUnitOverrideRef});
            onDirty();
          }}
        />
      ),
    },
    {
      title: '基础计量单位',
      width: 180,
      render: (_value, sku) => (
        <UnitOverrideSelect
          label="继承商品基础计量单位"
          value={sku.baseMeasureUnitOverrideRef}
          current={sku.baseMeasureUnit ?? undefined}
          units={unitOptions}
          onChange={baseMeasureUnitOverrideRef => {
            onUpdateSku(sku.editorId, {baseMeasureUnitOverrideRef});
            onDirty();
          }}
        />
      ),
    },
    {
      title: '状态',
      width: 120,
      render: (_value, sku) => (
        <Select
          aria-label="规格状态"
          style={{width: '100%'}}
          value={sku.status}
          options={catalogEnumOptions(manifest, 'skuStatus').filter(option => option.value !== 'VOIDED')}
          onChange={status => {
            onUpdateSku(sku.editorId, {status});
            onDirty();
          }}
          {...testId(catalogTestIdControls.edit.dynamic('sku', 'status', sku.editorId))}
        />
      ),
    },
    {
      title: '默认',
      width: 88,
      align: 'center',
      render: (_value, sku) => (
        <Switch
          aria-label="设为默认规格"
          checked={sku.isDefault}
          onChange={isDefault => {
            onUpdateSku(sku.editorId, {isDefault});
            onDirty();
          }}
          {...testId(catalogTestIdControls.edit.dynamic('sku', 'default', sku.editorId))}
        />
      ),
    },
    {
      title: '识别与制作',
      width: 200,
      render: (_value, sku) => (
        <Space direction="vertical" size={2}>
          <Button
            size="small"
            onClick={() => onOpenIdentifiers(sku.editorId)}
            {...testId(catalogTestIdControls.edit.dynamic('sku', 'identifiers', sku.editorId))}
          >
            识别码（{sku.identifiers.length || '未维护'}）
          </Button>
          <Button
            size="small"
            onClick={() => onOpenPreparation(sku.editorId)}
            {...testId(catalogTestIdControls.edit.dynamic('sku', 'preparation', sku.editorId))}
          >
            制作信息（{sku.preparationOverride.mode === 'OVERRIDE' ? '已单独设置' : '使用商品默认'}）
          </Button>
        </Space>
      ),
    },
    {
      title: '图片',
      width: 180,
      render: (_value, sku) => (
        <SkuMediaCell
          sku={sku}
          skuStagedMedia={skuStagedMedia}
          onStage={onStageSkuMedia}
          onRemove={onRemoveSkuMedia}
          onRemoveStaged={onRemoveSkuStagedMedia}
          onDirty={onDirty}
        />
      ),
    },
    {
      title: '规格管理',
      width: 150,
      fixed: 'right',
      render: (_value, sku) => {
        const issueCodes = catalogSkuIssueCodes(
          sku,
          priceGranularity,
          (combinationCounts.get(combinationKey(sku)) ?? 0) > 1,
          (codeCounts.get(sku.skuCode.trim()) ?? 0) > 1,
        );
        const reason = !canWriteCatalog
          ? '当前角色无权作废规格。'
          : (catalogVoidBlockReason(sku.voidAvailability) ?? '作废限制信息暂时无法确认，请刷新后重试。');
        return (
          <Space direction="vertical" size={2}>
            {issueCodes.length > 0 && (
              <Tooltip title={issueCodes.map(code => skuIssueLabels[code]).join('；')}>
                <Tag color="error">需处理 {issueCodes.length} 项</Tag>
              </Tooltip>
            )}
            <Tooltip title={reason} open={!canWriteCatalog || !sku.voidAvailability?.canVoid ? undefined : false}>
              <span>
                <Button
                  size="small"
                  danger
                  disabled={!canWriteCatalog || !sku.voidAvailability?.canVoid || Boolean(voidingSkuRef)}
                  loading={voidingSkuRef === sku.productSkuRef}
                  onClick={() => onVoidSku?.(sku)}
                  {...testId(catalogTestIdControls.edit.dynamic('sku', 'void', sku.editorId))}
                >
                  作废
                </Button>
              </span>
            </Tooltip>
            <Button
              size="small"
              danger
              type="link"
              onClick={() => {
                onRemoveSku(sku.editorId);
                onDirty();
              }}
              {...testId(catalogTestIdControls.edit.dynamic('sku-row', 'remove', sku.editorId))}
            >
              移除
            </Button>
          </Space>
        );
      },
    },
  ];
  return (
    <Space direction="vertical" size={8} style={{display: 'flex'}}>
      <div>
        <Typography.Title level={5} style={{margin: 0}}>
          2. 检查并补充每个规格
        </Typography.Title>
        <Typography.Text type="secondary">
          规格由上方属性和值生成；在这里补充每个规格的名称、价格、单位和制作信息。
        </Typography.Text>
      </div>
      <Table
        size="small"
        tableLayout="fixed"
        pagination={false}
        rowKey={sku => sku.editorId}
        columns={columns}
        dataSource={skus}
        scroll={{x: Math.max(1618, 1458 + dimensions.length * 160)}}
        locale={{emptyText: '请先维护规格属性和可选值，再生成规格'}}
      />
    </Space>
  );
}
