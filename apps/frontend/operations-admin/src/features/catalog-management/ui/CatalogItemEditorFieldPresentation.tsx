import {Alert, Card, Space, Typography} from 'antd';
import type {ReactNode} from 'react';
import type {CatalogDetail} from '../model/catalogModel';
import {catalogFieldLabel, catalogVoidBlockReasonLabel} from '../model/catalogManifestLabels';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';

const CATALOG_DENIED_FIELD_LABELS: Record<string, string> = {
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
  skuVariantDimensions: '规格维度',
  skuVariantAttribute: '规格属性',
  skuVariantValues: '规格值',
  skuMatrix: '规格列表',
  skus: '规格列表',
  orderOptionConfigs: '点单选项',
  inventoryBomComponent: '耗用对象',
  inventoryRules: '库存与 BOM',
  compositeComponentSku: '套餐组件规格',
  compositeGroups: '套餐内容',
};

export function catalogVoidBlockReason(
  availability: CatalogDetail['actionAvailability']['voidAvailability'] | undefined,
) {
  if (availability?.canVoid !== false) return undefined;
  const reasons = availability?.blockingReasons ?? [];
  if (reasons.length)
    return `${reasons
      .map(
        reason => `${catalogVoidBlockReasonLabel(reason.reasonCode)}${reason.count > 1 ? `（${reason.count}项）` : ''}`,
      )
      .join('、')}，暂不能作废。`;
  return '作废限制信息暂时无法确认，请刷新后重试。';
}

export function deniedFieldLabel(manifest: CatalogManifest | undefined, fieldKey: string) {
  const label = CATALOG_DENIED_FIELD_LABELS[fieldKey] ?? catalogFieldLabel(manifest, fieldKey);
  return label === fieldKey ? '上游维护字段' : label;
}

export function catalogCategorySummary(categoryRefDraft: string | undefined, pathLabels: string[]) {
  if (!categoryRefDraft) return <Typography.Text type="secondary">未分类</Typography.Text>;
  const path = pathLabels.join(' / ') || '—';
  return <Typography.Text ellipsis={{tooltip: path}}>{path}</Typography.Text>;
}

export function useCatalogItemEditorFieldPresentation(detail: NonNullable<CatalogDetail>, manifest?: CatalogManifest) {
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
  const lockedFact = (fieldKey: string, value: ReactNode) => (
    <Card size="small" style={{marginBottom: 12}}>
      <Space direction="vertical" size={4} style={{display: 'flex'}}>
        <Typography.Text type="secondary">{catalogFieldLabel(manifest, fieldKey)}</Typography.Text>
        <Typography.Text>{value || '未设置'}</Typography.Text>
        <Typography.Text type="secondary">由来源系统维护，当前仅可查看。</Typography.Text>
      </Space>
    </Card>
  );
  return {denied, fieldLabel, locked, lockedFact};
}
