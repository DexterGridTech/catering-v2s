import {Button, Descriptions, Space, Typography} from 'antd';
import {adminWideDetailDescriptionsProps, displayFieldValue} from '@catering-v2s/admin-ui-foundation';
import {catalogDetailImageRefs, type CatalogDetail} from '../model/catalogModel';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {CatalogAssetGallery} from './CatalogItemReadOnlyPresenters';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '未设置' : `¥${(value / 100).toFixed(2)}`;
}

function unitLabel(unit?: {name: string; code: string} | null) {
  return displayFieldValue(unit?.name);
}

export function CatalogItemBasicView({
  detail,
  manifest,
  onNavigateTab,
}: {
  detail: NonNullable<CatalogDetail>;
  manifest?: CatalogManifest;
  onNavigateTab: (tabKey: string) => void;
}) {
  const category = detail.item.categoryPath.map(node => node.name).join(' / ') || '—';
  return (
    <CatalogFactSectionView section="basic">
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {key: 'name', label: '商品名称', children: detail.item.name},
            {key: 'shortName', label: '短名', children: displayFieldValue(detail.item.shortName)},
            {key: 'code', label: '商品编码', children: detail.item.code},
            {key: 'shape', label: '商品形态', children: catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)},
            {
              key: 'status',
              label: '状态',
              children: (
                <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={detail.item.lifecycle.status} />
              ),
            },
            {
              key: 'category',
              label: '分类',
              children: <Typography.Text ellipsis={{tooltip: category}}>{category}</Typography.Text>,
            },
            {key: 'price', label: '标准价', children: money(detail.item.standardSalePrice ?? null)},
            {key: 'salesUnit', label: '销售单位', children: unitLabel(detail.item.salesUnit)},
            {key: 'baseUnit', label: '基础计量单位', children: unitLabel(detail.item.baseMeasureUnit)},
            {key: 'skuCount', label: '规格数量', children: `${detail.item.skuSummary.totalCount}`},
            {
              key: 'attributes',
              label: '商品属性',
              children: (
                <Button type="link" size="small" onClick={() => onNavigateTab('attributes')}>
                  {detail.item.attributeAssignments.length} 项
                </Button>
              ),
            },
            {
              key: 'options',
              label: '点单选项',
              children: (
                <Button type="link" size="small" onClick={() => onNavigateTab('order-options')}>
                  {detail.item.orderOptionConfigs.length} 组
                </Button>
              ),
            },
          ]}
        />
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {
              key: 'images',
              label: '图片',
              children: (
                <CatalogAssetGallery assetRefs={catalogDetailImageRefs(detail.item)} itemName={detail.item.name} />
              ),
            },
          ]}
        />
      </Space>
    </CatalogFactSectionView>
  );
}
