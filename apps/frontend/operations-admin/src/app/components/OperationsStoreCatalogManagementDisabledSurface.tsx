import {Alert, Button, Spin} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';

type StoreCatalogManagementGateState = 'LOADING' | 'FAILED' | 'DISABLED';

/**
 * App-owned shared surface for the store catalog capability gate.
 *
 * The gate state is produced by the store-operating-rules feature, but the
 * same presentation is consumed by the catalog, inventory, and sales-menu
 * features. Keeping the composition at app scope avoids private feature UI
 * imports without creating three divergent copies.
 */
export function OperationsStoreCatalogManagementDisabledSurface({
  state,
  onRetry,
}: {
  state: StoreCatalogManagementGateState;
  onRetry: () => void;
}) {
  if (state === 'LOADING') {
    return (
      <div {...testId('operations-store-operating-rule-loading')}>
        <Spin tip="正在获取门店经营规则…" />
      </div>
    );
  }
  if (state === 'FAILED') {
    return (
      <Alert
        type="error"
        showIcon
        title="门店经营规则读取未完成"
        description="暂时无法获取门店经营规则，请重试。"
        action={
          <Button {...testId('operations-store-operating-rule-retry')} onClick={onRetry}>
            重试
          </Button>
        }
        {...testId('operations-store-operating-rule-problem')}
      />
    );
  }
  return (
    <Alert
      type="info"
      showIcon
      title="功能尚未开启"
      description="需项目对门店授权"
      {...testId('operations-store-catalog-management-disabled')}
    />
  );
}
