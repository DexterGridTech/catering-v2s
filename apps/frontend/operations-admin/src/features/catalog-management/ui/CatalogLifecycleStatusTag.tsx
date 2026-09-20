import {Tag, Tooltip} from 'antd';
import {LIFECYCLE_COLORS, lifecycleLabel} from '@catering-v2s/admin-ui-foundation';
import {catalogEnumLabel} from '../model/catalogManifestLabels';

type LifecycleKind = 'ITEM' | 'SKU';

export function catalogLifecycleStatusPresentation(
  manifest: Parameters<typeof catalogEnumLabel>[0],
  kind: LifecycleKind,
  status: string,
  itemStatus?: string,
) {
  return {
    color: LIFECYCLE_COLORS[status as keyof typeof LIFECYCLE_COLORS] ?? 'default',
    label:
      status in LIFECYCLE_COLORS
        ? lifecycleLabel(status)
        : catalogEnumLabel(manifest, kind === 'ITEM' ? 'catalogItemStatus' : 'skuStatus', status),
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
