import {Alert, Button, Table, Tooltip, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {CatalogBatchResult} from '../model/catalogModel';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';

type Props = {
  results: readonly CatalogBatchResult[];
  refreshProblem?: string;
  onClose: () => void;
};

/** The authoritative receipt view for a completed catalog batch command. */
export function CatalogBatchOutcome({results, refreshProblem, onClose}: Props) {
  if (results.length === 0) return null;

  const succeeded = results.filter(result => result.outcome === 'SUCCEEDED').length;
  const failed = results.filter(result => result.outcome === 'FAILED');

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      <div aria-live="polite" {...testId(catalogTestIdControls.batch.summary)}>
        <Alert
          type={failed.length === 0 ? 'success' : 'warning'}
          showIcon
          title="批量操作完成"
          description={`成功 ${succeeded} 项，失败 ${failed.length} 项`}
        />
      </div>
      {refreshProblem && (
        <div {...testId(catalogTestIdControls.batch.refreshError)}>
          <Alert type="error" showIcon title={refreshProblem} />
        </div>
      )}
      <div
        aria-label="批量操作逐项结果"
        style={results.length > 8 ? {maxHeight: 360, overflowY: 'auto'} : undefined}
        {...testId(catalogTestIds.static.batchOutcomeFailures)}
      >
        <Typography.Text strong style={{display: 'block', marginBottom: 8}}>
          逐项处理结果
        </Typography.Text>
        <Table<CatalogBatchResult>
          bordered
          columns={[
            {
              title: '商品编码',
              dataIndex: 'itemCode',
              key: 'itemCode',
              width: 220,
              render: (itemCode: string) => (
                <Tooltip title={itemCode}>
                  <Typography.Text ellipsis style={{display: 'block', maxWidth: 200}}>
                    {itemCode}
                  </Typography.Text>
                </Tooltip>
              ),
            },
            {
              title: '处理结果',
              dataIndex: 'outcome',
              key: 'outcome',
              width: 104,
              render: (outcome: CatalogBatchResult['outcome']) => (
                <Typography.Text type={outcome === 'SUCCEEDED' ? 'success' : 'danger'}>
                  {outcome === 'SUCCEEDED' ? '已处理' : '未处理'}
                </Typography.Text>
              ),
            },
            {
              title: '说明',
              dataIndex: 'reason',
              key: 'reason',
              render: (reason: string | null, result: CatalogBatchResult) => (
                <Typography.Text
                  style={{whiteSpace: 'normal', overflowWrap: 'anywhere'}}
                  type={result.outcome === 'FAILED' ? undefined : 'secondary'}
                >
                  {result.outcome === 'FAILED' ? reason || '未提供失败原因' : '已按本次操作处理'}
                </Typography.Text>
              ),
            },
          ]}
          dataSource={results}
          pagination={false}
          rowKey="itemCode"
          size="small"
        />
      </div>
      <Button type="primary" onClick={onClose} {...testId(catalogTestIds.static.batchOutcomeClose)}>
        关闭
      </Button>
    </div>
  );
}
