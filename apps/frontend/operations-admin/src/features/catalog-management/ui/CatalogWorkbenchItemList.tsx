import {Alert, Button, Card, Dropdown, Input, Select, Space, Typography} from 'antd';
import {CursorPagination, testId} from '@catering-v2s/admin-ui-foundation';
import type {Key} from 'react';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import type {CatalogBatchAction} from '../model/catalogWorkspaceTask';
import {catalogFieldWidth} from './catalogFieldWidths';
import {CatalogItemListTable, type CatalogSkuChildrenState, type CatalogTableRow} from './CatalogItemListTable';

type Page = {items: Parameters<typeof CatalogItemListTable>[0]['items']; cursor: string};
type CursorState = {page: number; canPrevious: boolean; goToPage: (page: number, cursor?: string) => void};
type Props = {
  resultLabel: string;
  smartViewExplanation?: string;
  keyword: string;
  status?: string;
  source?: string;
  statusOptions: {value: string; label: string}[];
  sourceOptions: {value: string; label: string}[];
  statusConflict?: string;
  sourceConflict?: string;
  onKeywordChange: (value: string) => void;
  onKeywordSearch: () => void;
  onStatusChange: (value?: string) => void;
  onSourceChange: (value?: string) => void;
  onReset: () => void;
  onRefresh: () => void;
  selectedRows: Key[];
  canWrite: boolean;
  onBatchAction: (action: CatalogBatchAction) => void;
  onClearSelection: () => void;
  page: Page;
  cursorState: CursorState;
  manifest?: Parameters<typeof CatalogItemListTable>[0]['manifest'];
  skuChildrenByItem: Record<string, CatalogSkuChildrenState>;
  skuCacheIdentity: string;
  expandedRows: Key[];
  failed: boolean;
  scopeReady: boolean;
  noAuthorizedBrand: boolean;
  loading: boolean;
  onSelectedRowsChange: (keys: Key[]) => void;
  onTableExpand: (expanded: boolean, row: CatalogTableRow) => void;
  onOpenDetail: (itemCode: string, trigger: HTMLElement, initialViewTab?: string) => void;
  loadSkuPage: (itemCode: string, cursor?: string | null) => Promise<void>;
};

/** Presentation only: filters and batch intent are emitted to the workbench controller. */
export function CatalogWorkbenchItemList({
  resultLabel,
  smartViewExplanation,
  keyword,
  status,
  source,
  statusOptions,
  sourceOptions,
  statusConflict,
  sourceConflict,
  onKeywordChange,
  onKeywordSearch,
  onStatusChange,
  onSourceChange,
  onReset,
  onRefresh,
  selectedRows,
  canWrite,
  onBatchAction,
  onClearSelection,
  page,
  cursorState,
  manifest,
  skuChildrenByItem,
  skuCacheIdentity,
  expandedRows,
  failed,
  scopeReady,
  noAuthorizedBrand,
  loading,
  onSelectedRowsChange,
  onTableExpand,
  onOpenDetail,
  loadSkuPage,
}: Props) {
  const selectionSummary = selectedRows.length > 0 && (
    <Space size={8} style={{margin: 0}} {...testId(catalogTestIds.static.inventorySelectionSummary)}>
      <Typography.Text type="secondary">已选择 {selectedRows.length} 项</Typography.Text>
      {canWrite && (
        <Dropdown
          menu={{
            items: [
              {key: 'CATEGORY', label: '批量改分类'},
              {key: 'TAG', label: '批量改标签'},
              {key: 'STATUS', label: '批量改状态'},
            ],
            onClick: ({key}) => onBatchAction(key as CatalogBatchAction),
          }}
        >
          <Button {...testId(catalogTestIdControls.batch.action)}>批量操作</Button>
        </Dropdown>
      )}
      <Button type="link" size="small" onClick={onClearSelection}>
        取消选择
      </Button>
    </Space>
  );

  return (
    <div style={{minWidth: 0, flex: 1}}>
      <Card size="small" style={{marginBottom: 12}} title={`当前结果域：${resultLabel}`}>
        {smartViewExplanation && (
          <Alert
            type="info"
            showIcon
            title="智能视图结果域"
            description={smartViewExplanation}
            style={{marginBottom: 12}}
            {...testId(catalogTestIds.static.inventorySmartViewExplanation)}
          />
        )}
        <Space wrap>
          <Input.Search
            value={keyword}
            onChange={event => onKeywordChange(event.target.value)}
            onSearch={onKeywordSearch}
            placeholder="在当前结果域搜索：编码/名称/短名"
            style={{width: 320}}
            {...testId(catalogTestIds.control.resultKeyword)}
          />
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <Select
              style={catalogFieldWidth('compact')}
              allowClear
              disabled={Boolean(statusConflict)}
              value={status}
              placeholder="状态"
              options={statusOptions}
              onChange={onStatusChange}
              {...testId(catalogTestIds.control.resultStatus)}
            />
            {statusConflict && (
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                {statusConflict}
              </Typography.Text>
            )}
          </span>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <Select
              style={catalogFieldWidth('compact')}
              allowClear
              disabled={Boolean(sourceConflict)}
              value={source}
              placeholder="来源"
              options={sourceOptions}
              onChange={onSourceChange}
              {...testId(catalogTestIds.control.resultSource)}
            />
            {sourceConflict && (
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                {sourceConflict}
              </Typography.Text>
            )}
          </span>
          <Button onClick={onReset} {...testId(catalogTestIds.control.resultReset)}>
            重置
          </Button>
        </Space>
      </Card>
      <Card
        size="small"
        title={
          <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0}}>
            <span>商品列表</span>
            {selectionSummary}
          </div>
        }
        extra={
          <Button type="text" onClick={onRefresh} {...testId(catalogTestIdControls.workbench.refresh)}>
            刷新
          </Button>
        }
      >
        <div {...testId(catalogTestIds.surface.skuRows)}>
          <CatalogItemListTable
            tableTestId={catalogTestIds.surface.itemTable}
            items={page.items}
            manifest={manifest}
            skuChildrenByItem={skuChildrenByItem}
            skuCacheIdentity={skuCacheIdentity}
            selectedRows={selectedRows}
            expandedRows={expandedRows}
            failed={failed}
            scopeReady={scopeReady}
            noAuthorizedBrand={noAuthorizedBrand}
            loading={loading}
            onSelectedRowsChange={onSelectedRowsChange}
            onTableExpand={onTableExpand}
            onOpenDetail={onOpenDetail}
            loadSkuPage={loadSkuPage}
          />
        </div>
      </Card>
      <CursorPagination
        state={cursorState}
        nextCursor={page.cursor}
        testIdPrefix={catalogTestIds.static.inventoryItemPagination}
        style={{marginTop: 12}}
      />
    </div>
  );
}
