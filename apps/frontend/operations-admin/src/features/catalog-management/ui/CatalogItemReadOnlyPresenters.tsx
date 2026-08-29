import {Button, Card, Descriptions, Space, Tag, Tooltip, Typography} from 'antd';
import {adminWideDetailDescriptionsProps, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import type {ComponentProps, ReactNode} from 'react';
import type {CatalogShapeManifestView, JsonValue} from '../../../app/api/generated/catalog-inventory-edge';
import type {
  CatalogAttributeAssignment,
  CatalogCompositeGroup,
  CatalogDetail,
  CatalogOrderOptionConfig,
  CatalogPreparationProfile,
  CatalogSkuRow,
  CatalogSkuVariantDimension,
} from '../model/catalogModel';
import {catalogSkuIssueCodes, displayValue} from '../model/catalogModel';
import {catalogEnumLabel, catalogFieldLabel} from '../model/catalogManifestLabels';
import {CATALOG_IDENTIFIER_TYPE_LABELS} from '../model/catalogIdentificationPreparationFeedback';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CatalogAssetPreview} from './CatalogAssetPreview';
import {catalogVoidBlockReason as catalogItemVoidBlockReason} from './CatalogItemEditorFieldPresentation';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';
import {catalogBusinessName} from './catalogBusinessName';

export type CatalogReadOnlyManifest = Pick<
  CatalogShapeManifestView,
  'enumLabels' | 'fields' | 'fieldRules' | 'tabRules' | 'typeEffects' | 'identifierRules' | 'preparationRules'
>;
type ProductionTagOption = {tagRef: string; code: string; name: string; owner: string; status?: string};

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `¥${(value / 100).toFixed(2)}`;
}

const catalogVoidBlockReason = catalogItemVoidBlockReason;

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

type SkuDraftIssueCode = ReturnType<typeof catalogSkuIssueCodes>[number];
const skuIssueLabels: Record<SkuDraftIssueCode, string> = {
  MISSING_CODE: '缺少规格编码',
  MISSING_NAME: '缺少规格名称',
  DUPLICATE_CODE: '规格编码重复',
  DUPLICATE_COMBINATION: '属性组合重复',
};

export function EmptySection({text}: {text: string}) {
  return <Typography.Text type="secondary">{displayValue(text as JsonValue)}</Typography.Text>;
}

export function SkuMatrixReadOnly({
  manifest,
  dimensions,
  skus,
  summary,
  priceGranularity,
  standardSalePrice,
  canWriteCatalog,
  itemStatus,
  onVoidSku,
  voidingSkuRef,
}: {
  manifest?: CatalogReadOnlyManifest;
  dimensions: CatalogSkuVariantDimension[];
  skus: CatalogSkuRow[];
  summary: CatalogDetail['item']['skuSummary'];
  priceGranularity: string;
  standardSalePrice?: number | null;
  canWriteCatalog: boolean;
  itemStatus?: string;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
}) {
  const fieldLabel = (fieldKey: string) => catalogFieldLabel(manifest, fieldKey);
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemSkuMatrixReadonly)}
    >
      <Descriptions
        {...adminWideDetailDescriptionsProps}
        items={[
          {
            key: 'sku',
            label: '规格数量',
            children: `${summary.enabledCount}/${summary.nonArchivedCount}/${summary.totalCount}（启用/未作废/总数）`,
          },
          {
            key: 'granularity',
            label: '价格粒度',
            children: catalogEnumLabel(manifest, 'priceGranularity', priceGranularity),
          },
          {key: 'standard', label: '商品标准价', children: money(standardSalePrice)},
        ]}
      />
      <Card size="small" title={fieldLabel('skuVariantAttribute')}>
        {dimensions.length ? (
          dimensions.map(dimension => (
            <Typography.Text key={dimension.attributeCode} style={{display: 'block'}}>
              {dimension.attributeName || dimension.attributeCode}（{dimension.attributeCode}）：
              {dimension.values
                .map(value => `${value.valueLabel || value.valueCode}${value.status === 'VOIDED' ? ' · 作废' : ''}`)
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
              const issues = catalogSkuIssueCodes(sku, priceGranularity, false, false).map(
                issue => skuIssueLabels[issue],
              );
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
                  key={sku.productSkuRef || sku.skuCode}
                  size="small"
                  title={
                    <Space>
                      <NameCodeText name={sku.skuName} code={sku.skuCode} />
                      {issues.length > 0 && (
                        <Tag
                          color="error"
                          {...testId(catalogTestIdControls.view.skuIssue(sku.productSkuRef || sku.skuCode))}
                        >
                          需处理 {issues.length} 项
                        </Tag>
                      )}
                    </Space>
                  }
                  extra={
                    onVoidSku ? (
                      <DisabledReasonButton
                        danger
                        disabled={!canWriteCatalog || !sku.voidAvailability?.canVoid || Boolean(voidingSkuRef)}
                        loading={voidingSkuRef === sku.productSkuRef}
                        reason={
                          !canWriteCatalog
                            ? '当前角色无权作废规格。'
                            : (catalogVoidBlockReason(sku.voidAvailability) ??
                              '作废限制信息暂时无法确认，请刷新后重试。')
                        }
                        onClick={() => onVoidSku(sku)}
                      >
                        作废规格
                      </DisabledReasonButton>
                    ) : undefined
                  }
                >
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
                        children: (
                          <Space size={4}>
                            <CatalogLifecycleStatusTag
                              manifest={manifest}
                              kind="SKU"
                              status={sku.status}
                              itemStatus={itemStatus}
                            />
                            {sku.isDefault ? <Typography.Text type="secondary">默认规格</Typography.Text> : null}
                          </Space>
                        ),
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
                                alt={`${sku.skuName || sku.skuCode || `规格 ${skuIndex + 1}`}图片 ${mediaIndex + 1}`}
                                width={96}
                                height={72}
                                testId={catalogTestIdControls.view.skuMedia(sku.productSkuRef || sku.skuCode, assetRef)}
                              />
                            ))}
                          </Space>
                        ) : (
                          '未配置'
                        ),
                      },
                    ]}
                  />
                  {issues.length > 0 && (
                    <Typography.Text
                      type="danger"
                      {...testId(catalogTestIdControls.view.skuIssueText(sku.productSkuRef || sku.skuCode))}
                    >
                      {issues.join('；')}
                    </Typography.Text>
                  )}
                </Card>
              );
            })}
          </Space>
        ) : (
          <EmptySection text="未维护规格明细" />
        )}
      </Card>
    </Space>
  );
}

export function PreparationProfileReadOnly({
  profile,
  tag,
}: {
  profile: CatalogPreparationProfile | null;
  tag?: ProductionTagOption;
}) {
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemPreparationReadonly)}
    >
      {!profile && !tag ? (
        <EmptySection text="尚未设置制作信息" />
      ) : (
        <Descriptions
          size="small"
          column={2}
          items={[
            {
              key: 'tags',
              label: '生产标签',
              children: tag ? <Tag>{catalogBusinessName(tag.name, tag.code, '生产标签名称暂时无法读取')}</Tag> : '—',
            },
            {key: 'name', label: '制作单显示名称', children: profile?.productionDisplayName || '—'},
            {key: 'seconds', label: '预计制作时长（秒）', children: profile?.estimatedPreparationSeconds ?? '—'},
            {key: 'notes', label: '制作说明', children: profile?.preparationNotes || '—'},
          ]}
        />
      )}
    </Space>
  );
}

function catalogPreparationLayout(shapeKey: string, skuCount: number, optionEffectCount: number) {
  const hasSkuVariation = shapeKey === 'SKU_VARIANT_SALE_COUNTED' && skuCount > 0;
  const hasOptionVariation = optionEffectCount > 0;
  if (hasSkuVariation && hasOptionVariation) return 'SKU_AND_OPTIONS';
  if (hasSkuVariation) return 'SKU';
  if (hasOptionVariation) return 'OPTIONS';
  return 'ITEM_ONLY';
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
      data-preparation-layout={layout}
      {...testId(catalogTestIds.static.preparationVariationSummary)}
    >
      {(layout === 'SKU' || layout === 'SKU_AND_OPTIONS') && (
        <Typography.Text>已有规格单独设置制作信息。</Typography.Text>
      )}
      {(layout === 'OPTIONS' || layout === 'SKU_AND_OPTIONS') && (
        <Button type="link" onClick={onNavigateToOptions} {...testId(catalogTestIds.static.itemOptionPreparationLink)}>
          {optionEffectCount} 个点单选项已设置制作变化，去点单选项维护
        </Button>
      )}
    </Card>
  );
}

export function CompositeGroupsReadOnly({values}: {values: CatalogCompositeGroup[]}) {
  if (!values.length) return <EmptySection text="未维护套餐分组" />;
  const selectionRuleLabel: Record<string, string> = {
    FIXED: '固定包含',
    SINGLE: '任选一项',
    MULTIPLE: '可多选',
  };
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemCompositeGroupsReadonly)}
    >
      {values.map(group => (
        <Card
          key={group.groupCode || group.groupName}
          size="small"
          title={group.groupName || '未命名套餐分组'}
          extra={<Tag>{selectionRuleLabel[group.selectionRule] ?? '选择方式未设置'}</Tag>}
        >
          {group.components.length ? (
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              {group.components.map((component, index) => {
                const hasExtraPrice =
                  component.extraPrice !== null && component.extraPrice !== undefined && component.extraPrice !== 0;
                return (
                  <div
                    key={`${component.itemRef}-${index}`}
                    style={{borderInlineStart: '3px solid #d6e4ff', paddingInlineStart: 12}}
                  >
                    <Space align="center" wrap size={[8, 4]}>
                      <Typography.Text strong>
                        {catalogBusinessName(component.itemName, component.itemCode, '商品资料暂时无法读取')}
                      </Typography.Text>
                      {component.skuName ? (
                        <Typography.Text type="secondary">
                          {catalogBusinessName(component.skuName, component.skuCode, '规格名称暂时无法读取')}
                        </Typography.Text>
                      ) : null}
                      {component.default ? <Tag color="blue">默认内容</Tag> : null}
                      {component.status === 'DISABLED' ? <Tag color="warning">暂不提供</Tag> : null}
                    </Space>
                    <Typography.Text type="secondary" style={{display: 'block', marginTop: 2}}>
                      数量：{component.quantity || '未设置'} {component.unit || '单位未设置'}
                      {hasExtraPrice ? `　加价：${money(component.extraPrice)}` : ''}
                    </Typography.Text>
                  </div>
                );
              })}
            </Space>
          ) : (
            <EmptySection text="尚未添加套餐内容" />
          )}
        </Card>
      ))}
    </Space>
  );
}

export function CatalogAssetGallery({assetRefs, itemName}: {assetRefs: string[]; itemName: string}) {
  return (
    <Space wrap size={8} {...testId(catalogTestIds.static.itemMediaGallery)}>
      {assetRefs.length
        ? assetRefs.map((assetRef, index) => (
            <Space direction="vertical" size={2} key={`${assetRef}-${index}`}>
              <CatalogAssetPreview
                assetRef={assetRef}
                alt={`${itemName}${index === 0 ? '主图' : `附图 ${index}`}预览`}
                width={160}
                height={120}
                testId={catalogTestIdControls.view.itemMedia(assetRef)}
              />
              <Typography.Text type="secondary">{index === 0 ? '主图' : `附图 ${index}`}</Typography.Text>
            </Space>
          ))
        : '未配置图片'}
    </Space>
  );
}

export function AttributeAssignmentsReadOnly({values}: {values: CatalogAttributeAssignment[]}) {
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

export function OrderOptionConfigurationsReadOnly({values}: {values: CatalogOrderOptionConfig[]}) {
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
