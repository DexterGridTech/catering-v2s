import {Alert, Button, Descriptions, Space, Typography} from 'antd';
import {adminWideDetailDescriptionsProps, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import type {CatalogDetail} from '../model/catalogModel';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogTestIds} from '../catalogTestIds';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';

function referenceGroupLabel(direction: string): string {
  return direction === 'INBOUND' ? '被其他商品引用' : '引用其他商品';
}

export function CatalogItemGovernanceView({
  detail,
  manifest,
  onOpenReferencedItem,
}: {
  detail: NonNullable<CatalogDetail>;
  manifest?: CatalogManifest;
  onOpenReferencedItem?: (itemCode: string) => void;
}) {
  const availability = detail.actionAvailability.voidAvailability;
  const blockingReasons = availability?.blockingReasons ?? [];
  const referenceSummary = detail.references.length ? (
    <Space direction="vertical" size={10} style={{display: 'flex'}}>
      {[
        ...new Map(
          detail.references.map(entry => {
            const label = referenceGroupLabel(entry.direction);
            return [label, detail.references.filter(row => referenceGroupLabel(row.direction) === label)] as const;
          }),
        ).entries(),
      ].map(([location, entries]) => (
        <div key={location}>
          <Typography.Text strong>{location}</Typography.Text>
          <Space wrap size={[4, 4]} style={{display: 'flex', marginTop: 4}}>
            {entries.map(entry => (
              <Button
                key={`${entry.direction}:${entry.referenceRef}`}
                type="link"
                style={{paddingInline: 0}}
                onClick={() => onOpenReferencedItem?.(entry.code)}
                disabled={!onOpenReferencedItem}
              >
                <NameCodeText name={entry.name} code={entry.code} />
              </Button>
            ))}
          </Space>
        </div>
      ))}
    </Space>
  ) : (
    '没有与其他商品的关联'
  );
  return (
    <CatalogFactSectionView section="governance">
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Descriptions
          {...adminWideDetailDescriptionsProps}
          items={[
            {key: 'shape', label: '商品形态', children: catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)},
            {
              key: 'status',
              label: '生命周期状态',
              children: (
                <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={detail.item.lifecycle.status} />
              ),
            },
            {
              key: 'references',
              label: `商品关联（${detail.references.length}）`,
              children: referenceSummary,
            },
          ]}
        />
        {availability?.canVoid === false && (
          <Alert
            type="warning"
            showIcon
            title="当前不可作废"
            description={
              blockingReasons.length ? (
                <Space direction="vertical" size={2} style={{display: 'flex'}}>
                  {blockingReasons.map(reason => (
                    <Typography.Text key={`${reason.label}:${reason.count}`}>
                      {reason.label}
                      {reason.count > 1 ? `（${reason.count}项）` : ''}
                      {reason.relatedItemNames.length ? `：${reason.relatedItemNames.join('、')}` : ''}
                    </Typography.Text>
                  ))}
                </Space>
              ) : (
                '作废限制信息暂时无法确认，请刷新后重试。'
              )
            }
            {...testId(catalogTestIds.static.itemVoidBlockReasons)}
          />
        )}
      </Space>
    </CatalogFactSectionView>
  );
}
