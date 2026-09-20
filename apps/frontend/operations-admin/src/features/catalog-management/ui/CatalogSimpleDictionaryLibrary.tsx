import {Button, Empty, Flex, Input, Select, Space, Table, Tag, Tooltip, Typography} from 'antd';
import {
  CursorPagination,
  displayFieldValue,
  LIFECYCLE_LABELS,
  type CursorStackState,
  testId,
} from '@catering-v2s/admin-ui-foundation';
import type {HTMLAttributes, ReactNode} from 'react';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';

export type SimpleDictionaryRow = {
  entryRef: string;
  code: string;
  name: string;
  status: string;
  unitDimension?: string;
  precision?: number;
  isReferenced?: boolean;
};

export type SimpleDictionaryFilter = {
  keywordInput: string;
  status?: 'ENABLED' | 'DISABLED' | 'VOIDED';
  setKeywordInput: (value: string) => void;
  applyKeyword: () => void;
  clearKeyword: () => void;
  setStatus: (value?: 'ENABLED' | 'DISABLED' | 'VOIDED') => void;
};

/**
 * The list-is-detail presentation for product tags, units and production tags.
 * It intentionally owns no server query, mutation, drawer lifecycle, or draft:
 * those facts remain in CatalogDictionaryDrawerState/useCatalogConfigLibrary.
 */
export function CatalogSimpleDictionaryLibrary({
  entityLabel,
  libraryKey,
  description,
  rows,
  filter,
  canWrite,
  isUnit,
  isProduction,
  loading,
  createLabel,
  onCreate,
  renderStatus,
  renderUnitDimension,
  renderActions,
  pagination,
}: {
  entityLabel: string;
  libraryKey: string;
  description: string;
  rows: SimpleDictionaryRow[];
  filter: SimpleDictionaryFilter;
  canWrite: boolean;
  isUnit: boolean;
  isProduction: boolean;
  loading: boolean;
  createLabel: string;
  onCreate: () => void;
  renderStatus: (value: string) => ReactNode;
  renderUnitDimension: (value?: string) => ReactNode;
  renderActions: (row: SimpleDictionaryRow) => ReactNode;
  pagination?: {state: CursorStackState; nextCursor?: string; testIdPrefix: string};
}) {
  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" gap="middle">
        <Typography.Text type="secondary">{description}</Typography.Text>
        {canWrite && rows.length > 0 && (
          <Button type="primary" onClick={onCreate} {...testId(catalogTestIds.static.dictionaryOpenCreate)}>
            {createLabel}
          </Button>
        )}
      </Flex>
      <Flex gap="small" wrap="wrap" align="center">
        <Input.Search
          value={filter.keywordInput}
          onChange={event => {
            if (event.target.value) filter.setKeywordInput(event.target.value);
            else filter.clearKeyword();
          }}
          onSearch={filter.applyKeyword}
          placeholder="搜索名称或编码"
          allowClear
          style={{width: 320, maxWidth: '100%'}}
          aria-label={`搜索${entityLabel}`}
          {...testId(catalogTestIds.control.configSearch)}
        />
        <Select<'ALL' | 'ENABLED' | 'DISABLED' | 'VOIDED'>
          value={filter.status ?? 'ALL'}
          onChange={value => filter.setStatus(value === 'ALL' ? undefined : value)}
          options={[
            {value: 'ALL', label: '全部状态'},
            {value: 'ENABLED', label: '启用'},
            {value: 'DISABLED', label: LIFECYCLE_LABELS.DISABLED},
            {value: 'VOIDED', label: LIFECYCLE_LABELS.VOIDED},
          ]}
          optionRender={option => (
            <span {...testId(catalogTestIdControls.config.statusOption(String(option.value)))}>{option.label}</span>
          )}
          style={{width: 160}}
          aria-label={`筛选${entityLabel}状态`}
          {...testId(catalogTestIds.control.configStatus)}
        />
      </Flex>
      <div {...(isProduction ? testId(catalogTestIds.surface.configProductionTags) : {})}>
        <Table<SimpleDictionaryRow>
          size="small"
          rowKey="entryRef"
          loading={loading}
          dataSource={rows}
          pagination={false}
          onRow={row =>
            testId(catalogTestIdControls.config.row(libraryKey, row.code)) as HTMLAttributes<HTMLTableRowElement>
          }
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`还没有${entityLabel}。`}>
                {canWrite && (
                  <Button type="primary" onClick={onCreate} {...testId(catalogTestIds.static.dictionaryOpenCreate)}>
                    {createLabel}
                  </Button>
                )}
              </Empty>
            ),
          }}
          columns={[
            {title: '名称', dataIndex: 'name'},
            {title: '编码', dataIndex: 'code'},
            ...(isUnit
              ? [
                  {title: '维度', dataIndex: 'unitDimension', render: renderUnitDimension},
                  {title: '精度', dataIndex: 'precision', render: (value?: number) => displayFieldValue(value)},
                  {
                    title: '正在使用',
                    dataIndex: 'isReferenced',
                    render: (value?: boolean) =>
                      value ? <Tag color="blue">是</Tag> : <Typography.Text type="secondary">否</Typography.Text>,
                  },
                ]
              : []),
            {title: '状态', dataIndex: 'status', render: renderStatus},
            {key: 'actions', render: (_: unknown, row: SimpleDictionaryRow) => <Space>{renderActions(row)}</Space>},
          ]}
          {...testId(catalogTestIds.static.dictionaryTable)}
        />
      </div>
      {pagination && (
        <CursorPagination
          state={pagination.state}
          nextCursor={pagination.nextCursor}
          testIdPrefix={pagination.testIdPrefix}
          style={{marginTop: 12}}
        />
      )}
    </Flex>
  );
}

/** Keeps disabled actions operable for screen readers while explaining the business reason to pointer users. */
export function withSimpleDictionaryMutationReason(content: ReactNode, disabled: boolean, reason?: string) {
  if (!disabled || !reason) return content;
  return (
    <Tooltip title={reason}>
      <span style={{display: 'inline-block'}}>{content}</span>
    </Tooltip>
  );
}
