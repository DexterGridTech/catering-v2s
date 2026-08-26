import {Alert, Descriptions, Space, Tag, Typography} from 'antd';
import {adminWideDetailDescriptionsProps, testId} from '@catering-v2s/admin-ui-foundation';
import type {CatalogDetail} from '../model/catalogModel';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import {catalogTestIds} from '../catalogTestIds';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';

/** A read-only governance fact family, deliberately separate from ordinary save fields. */
export function CatalogItemGovernanceEditor({
  detail,
  manifest,
  deniedFieldLabel,
}: {
  detail: CatalogDetail;
  manifest?: CatalogManifest;
  deniedFieldLabel: (fieldKey: string) => string;
}) {
  const voidAvailability = detail.actionAvailability.voidAvailability;
  const blockingReasons = voidAvailability?.blockingReasons ?? [];
  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}}>
      <Alert
        type="info"
        showIcon
        title="关联与依赖（只读）"
        description="这里用于查看商品被使用的位置和可执行的后续动作，不会随本次编辑保存。"
      />
      <Descriptions
        {...adminWideDetailDescriptionsProps}
        items={[
          {key: 'shape', label: '商品形态', children: catalogEnumLabel(manifest, 'shapeKey', detail.item.shapeKey)},
          {
            key: 'status',
            label: '生命周期状态',
              children: <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={detail.item.lifecycle.status} />,
          },
          {
            key: 'references',
            label: `关联与依赖（${detail.references.length}）`,
            children: detail.references.length
              ? [...new Map(detail.references.map(entry => [entry.relationLabel, 0])).keys()]
                  .map(label => `${label}（${detail.references.filter(entry => entry.relationLabel === label).length}项）`)
                  .join('；')
              : '没有与其他商品的关联',
          },
          {
            key: 'denied-fields',
            label: '上游锁定字段',
            children: detail.deniedFields.length ? (
              <Space wrap>
                {detail.deniedFields.map(field => (
                  <Tag key={field} color="gold">
                    {deniedFieldLabel(field)}
                  </Tag>
                ))}
              </Space>
            ) : (
              '无锁定字段'
            ),
          },
        ]}
      />
      {voidAvailability?.canVoid === false && (
        <Alert
          type="warning"
          showIcon
          title="当前不可作废"
          description={
            blockingReasons.length ? (
              <Space direction="vertical" size={2}>
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
  );
}
