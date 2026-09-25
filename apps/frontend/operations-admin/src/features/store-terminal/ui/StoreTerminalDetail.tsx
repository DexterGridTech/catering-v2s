import {Fragment, type ReactNode, type RefObject} from 'react';
import {Button, Card, Descriptions, Empty, Space, Tag, Typography} from 'antd';
import {
  AdminDetailActionMenu,
  AdminDetailActionLabel,
  adminDetailDescriptionsProps,
  lifecycleColor,
  NameCodeText,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import type {
  StoreTerminalDetail as StoreTerminalDetailValue,
  StoreTerminalStatus,
} from '../../../app/api/generated/operations-edge';
import {STORE_TERMINAL_RANGE_KEYS} from '../../../app/api/generated/storeTerminalRules';
import {
  scenesForFunction,
  storeTerminalConnectionMethodLabels,
  storeTerminalDeviceTypeLabels,
  storeTerminalFunctionLabels,
  storeTerminalBrandLabels,
  storeTerminalModelLabels,
  storeTerminalOrderTypeLabels,
  storeTerminalPaperSpecLabels,
  storeTerminalRangeLabels,
  storeTerminalStatusLabels,
} from '../model/storeTerminalModel';
import {storeTerminalTestIds} from '../storeTerminalTestIds';

function statusTag(status: StoreTerminalStatus) {
  return <Tag color={lifecycleColor(status)}>{storeTerminalStatusLabels[status]}</Tag>;
}

const areaTypeLabels: Record<string, string> = {TABLE_AREA: '桌台区', SCAN_AREA: '扫码区'};

function rangeText(range: {key: string; all: boolean; refs: string[]}, value: StoreTerminalDetailValue): ReactNode {
  if (range.all) return `全部${storeTerminalRangeLabels[range.key] ?? range.key}`;
  if (!range.refs.length) return storeTerminalRangeLabels[range.key] ?? range.key;
  const labels = range.refs.map(ref => {
    if (range.key === STORE_TERMINAL_RANGE_KEYS.TABLE_AREA) {
      const area = value.areaReferences.find(item => String(item.areaRef) === String(ref));
      return area ? (
        <span key={String(ref)}>
          <NameCodeText name={area.name} code={area.code} />
          {' · '}
          {areaTypeLabels[area.areaType] ?? area.areaType}
          {' · '}
          {storeTerminalStatusLabels[area.status as StoreTerminalStatus] ?? area.status}
        </span>
      ) : (
        '当前引用（需重新核对）'
      );
    }
    const tag = value.tagReferences.find(item => String(item.tagRef) === String(ref));
    return tag ? (
      <span key={String(ref)}>
        <NameCodeText name={tag.name} code={tag.code} />
        {' · '}
        {storeTerminalStatusLabels[tag.status as StoreTerminalStatus] ?? tag.status}
      </span>
    ) : (
      '当前引用（需重新核对）'
    );
  });
  return (
    <>
      {storeTerminalRangeLabels[range.key] ?? range.key}：
      {labels.map((label, index) => (
        <Fragment key={`${range.key}-${index}`}>
          {index > 0 ? '、' : ''}
          {label}
        </Fragment>
      ))}
    </>
  );
}

export function StoreTerminalDetail({
  value,
  canEdit,
  onEdit,
  onStatus,
  statusTriggerRef,
  emptyDescription = '请选择终端',
}: {
  value?: StoreTerminalDetailValue;
  canEdit: boolean;
  onEdit: () => void;
  onStatus: (status: StoreTerminalStatus, trigger?: HTMLButtonElement) => void;
  statusTriggerRef?: RefObject<HTMLButtonElement | null>;
  emptyDescription?: ReactNode;
}) {
  if (!value) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;

  const actionItem = (status: StoreTerminalStatus, label: string, danger = false) => ({
    key: status,
    label: (
      <AdminDetailActionLabel testIdValue={storeTerminalTestIds.statusAction(status)}>{label}</AdminDetailActionLabel>
    ),
    danger,
    onClick: () => onStatus(status, statusTriggerRef?.current ?? undefined),
  });
  const actionItems = [
    ...(value.status === 'ENABLED'
      ? [actionItem('DISABLED', '停用终端')]
      : value.status === 'DISABLED'
        ? [actionItem('ENABLED', '启用终端')]
        : []),
    ...(value.status === 'VOIDED' ? [] : [actionItem('VOIDED', '作废终端', true)]),
  ];
  const printerByRef = new Map(value.configuration.printers.map(printer => [String(printer.ref), printer]));
  const functionOccurrences = new Map<string, number>();
  const functionTotals = new Map<string, number>();
  value.configuration.functions.forEach(fn =>
    functionTotals.set(fn.functionKey, (functionTotals.get(fn.functionKey) ?? 0) + 1),
  );

  return (
    <Space direction="vertical" size={16} style={{display: 'flex'}} {...testId(storeTerminalTestIds.detail)}>
      <Card
        size="small"
        title={value.name}
        extra={
          canEdit ? (
            <Space size={4}>
              {value.status !== 'VOIDED' && (
                <Button onClick={onEdit} {...testId(storeTerminalTestIds.edit)}>
                  编辑
                </Button>
              )}
              {actionItems.length > 0 && (
                <AdminDetailActionMenu
                  items={actionItems}
                  triggerTestId={storeTerminalTestIds.actionMenu}
                  triggerRef={statusTriggerRef}
                />
              )}
            </Space>
          ) : undefined
        }
      >
        <Descriptions {...adminDetailDescriptionsProps} column={1}>
          <Descriptions.Item label="设备类型">
            {storeTerminalDeviceTypeLabels[value.deviceType] ?? value.deviceType}
          </Descriptions.Item>
          <Descriptions.Item label="状态">{statusTag(value.status)}</Descriptions.Item>
          <Descriptions.Item label="激活码">
            <Typography.Text>{value.activationCode}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="打印机信息">
        {value.configuration.printers.length === 0 ? (
          <Typography.Text type="secondary">未配置打印机</Typography.Text>
        ) : (
          <Descriptions {...adminDetailDescriptionsProps} column={1}>
            {value.configuration.printers.map(printer => (
              <Descriptions.Item key={String(printer.ref)} label={printer.name}>
                {[
                  storeTerminalBrandLabels[printer.brandKey] ?? printer.brandKey,
                  storeTerminalModelLabels[printer.modelKey] ?? printer.modelKey,
                  storeTerminalPaperSpecLabels[printer.paperSpecKey] ?? printer.paperSpecKey,
                  storeTerminalConnectionMethodLabels[printer.connectionMethodKey] ?? printer.connectionMethodKey,
                  printer.connectionParameter,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Card>

      <Card size="small" title="功能与范围">
        {value.configuration.functions.length === 0 ? (
          <Typography.Text type="secondary">未配置功能</Typography.Text>
        ) : (
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            {value.configuration.functions.map(fn => {
              const occurrence = (functionOccurrences.get(fn.functionKey) ?? 0) + 1;
              functionOccurrences.set(fn.functionKey, occurrence);
              return (
                <Card
                  size="small"
                  type="inner"
                  key={String(fn.ref)}
                  title={`${storeTerminalFunctionLabels[fn.functionKey] ?? fn.functionKey}${(functionTotals.get(fn.functionKey) ?? 0) > 1 ? ` ${occurrence}` : ''}`}
                >
                  <Descriptions {...adminDetailDescriptionsProps} column={1}>
                    <Descriptions.Item label="范围">
                      <Space wrap>
                        {fn.ranges.length ? (
                          fn.ranges.map(range => <Tag key={range.key}>{rangeText(range, value)}</Tag>)
                        ) : (
                          <Typography.Text type="secondary">未设置范围</Typography.Text>
                        )}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="打印场景">
                      <Space direction="vertical" size={8} style={{display: 'flex'}}>
                        {fn.scenes.map(scene => (
                          <Space key={scene.sceneKey} wrap>
                            <Typography.Text>
                              {scenesForFunction(fn.functionKey).find(candidate => candidate.key === scene.sceneKey)
                                ?.label ?? scene.sceneKey}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {scene.orderTypes
                                .map(orderType => storeTerminalOrderTypeLabels[orderType] ?? orderType)
                                .join('、') || '未限定订单类型'}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {scene.printers
                                .map(
                                  binding =>
                                    printerByRef.get(String(binding.printerRef))?.name ?? String(binding.printerRef),
                                )
                                .join('、') || '未选打印机'}
                            </Typography.Text>
                          </Space>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              );
            })}
          </Space>
        )}
      </Card>
    </Space>
  );
}
