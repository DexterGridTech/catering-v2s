import {Tag, Tooltip} from 'antd';
import {catalogEnumLabel} from '../model/catalogManifestLabels';

type LifecycleKind = 'ITEM' | 'SKU';

const lifecycleColors: Record<string, 'default' | 'success' | 'warning' | 'processing' | 'error'> = {
  DRAFT: 'default',
  ENABLED: 'success',
  DISABLED: 'warning',
  ARCHIVED: 'processing',
  VOIDED: 'error',
};

export function catalogLifecycleStatusPresentation(
  manifest: Parameters<typeof catalogEnumLabel>[0],
  kind: LifecycleKind,
  status: string,
  itemStatus?: string,
) {
  return {
    color: lifecycleColors[status] ?? 'default',
    label: catalogEnumLabel(manifest, kind === 'ITEM' ? 'catalogItemStatus' : 'skuStatus', status),
    tooltip:
      kind === 'SKU'
        ? itemStatus && itemStatus !== 'ENABLED'
          ? '规格状态独立维护；商品尚未启用时不会作为启用商品使用。'
          : '规格状态独立维护。'
        : undefined,
  };
}

export function CatalogLifecycleStatusTag({
  manifest,
  kind,
  status,
  itemStatus,
}: {
  manifest: Parameters<typeof catalogEnumLabel>[0];
  kind: LifecycleKind;
  status: string;
  itemStatus?: string;
}) {
  const presentation = catalogLifecycleStatusPresentation(manifest, kind, status, itemStatus);
  const tag = <Tag color={presentation.color}>{presentation.label}</Tag>;
  return presentation.tooltip ? <Tooltip title={presentation.tooltip}>{tag}</Tooltip> : tag;
}
