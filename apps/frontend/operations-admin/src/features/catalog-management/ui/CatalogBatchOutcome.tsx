import {Alert, Button, Table, Tooltip, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogBatchFailureReasonLabel, type CatalogBatchResult} from '../model/catalogModel';
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
    <div className="catalog-batch-outcome">
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
      {failed.length > 0 && (
        <div className="catalog-batch-outcome__failures">
          <Typography.Text strong style={{display: 'block', marginBottom: 8}}>
            以下 {failed.length} 个商品未处理成功
          </Typography.Text>
          <div
            className="catalog-batch-outcome__failure-table"
            aria-label="批量操作失败结果"
            tabIndex={0}
            {...testId(catalogTestIds.static.batchOutcomeFailures)}
          >
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
                  render: (_reason: string | null, result: CatalogBatchResult) => (
                    <Typography.Text style={{whiteSpace: 'normal', overflowWrap: 'anywhere'}}>
                      {catalogBatchFailureReasonLabel(result.problemCode, result.reason)}
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
        </div>
      )}
      <Button type="primary" onClick={onClose} {...testId(catalogTestIds.static.batchOutcomeClose)}>
        关闭
      </Button>
    </div>
  );
}
