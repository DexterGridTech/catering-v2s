import {Alert, Button, Table, Tooltip, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {CatalogBatchResult} from '../model/catalogModel';

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
      <div aria-live="polite" {...testId('catalog-batch-outcome-summary')}>
        <Alert
          type={failed.length === 0 ? 'success' : 'warning'}
          showIcon
          title="批量操作完成"
          description={`成功 ${succeeded} 项，失败 ${failed.length} 项`}
        />
      </div>
      {refreshProblem && <Alert type="error" showIcon title={refreshProblem} />}
      {failed.length > 0 && (
        <div
          aria-label="批量操作失败商品"
          style={{maxHeight: '50vh', overflowY: 'auto'}}
          {...testId('catalog-batch-outcome-failures')}
        >
          <Typography.Text strong style={{display: 'block', marginBottom: 8}}>
            以下 {failed.length} 个商品未处理成功
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
                title: '失败原因',
                dataIndex: 'reason',
                key: 'reason',
                render: (reason: string | null) => (
                  <Typography.Text style={{whiteSpace: 'normal', overflowWrap: 'anywhere'}}>
                    {reason || '未提供失败原因'}
                  </Typography.Text>
                ),
              },
            ]}
            dataSource={failed}
            pagination={false}
            rowKey="itemCode"
            size="small"
          />
        </div>
      )}
      <Button type="primary" onClick={onClose} {...testId('catalog-batch-outcome-close')}>
        关闭
      </Button>
    </div>
  );
}
