import {Alert, Button} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {ComponentProps} from 'react';
import {catalogTestIds} from '../catalogTestIds';
import type {StoreOperatingRuleGateState} from '../../store-operating-rules/model/useStoreOperatingRuleGate';
import {OperationsStoreCatalogManagementDisabledSurface} from '../../../app/components/OperationsStoreCatalogManagementDisabledSurface';
import type {CatalogSurface} from './controllers/CatalogWorkbenchController';
import {CatalogWorkbenchItemList} from './CatalogWorkbenchItemList';
import {CatalogWorkbenchNavigationTree} from './CatalogWorkbenchNavigationTree';
import {CatalogWorkbenchToolbar} from './CatalogWorkbenchToolbar';

type Props = {
  surface: CatalogSurface;
  rootTestId: string;
  scopeForbidden: boolean;
  failed: boolean;
  noAuthorizedBrand: boolean;
  noSelectedScope: boolean;
  ruleState: StoreOperatingRuleGateState;
  onRuleRetry: () => void;
  treeVisible: boolean;
  toolbarProps: ComponentProps<typeof CatalogWorkbenchToolbar>;
  navigationProps: ComponentProps<typeof CatalogWorkbenchNavigationTree>;
  itemListProps: ComponentProps<typeof CatalogWorkbenchItemList>;
  onRefresh: () => void;
};

/** Pure workbench surface composition. Query, draft and task state remain outside this component. */
export function CatalogWorkbenchContent({
  surface,
  rootTestId,
  scopeForbidden,
  failed,
  noAuthorizedBrand,
  noSelectedScope,
  ruleState,
  onRuleRetry,
  treeVisible,
  toolbarProps,
  navigationProps,
  itemListProps,
  onRefresh,
}: Props) {
  return (
    <section {...testId(rootTestId)}>
      {scopeForbidden && (
        <Alert
          type="error"
          showIcon
          title="当前范围无权访问商品数据"
          description="请切换到有权限的数据节点或品牌；系统不会展示其他范围的商品。"
          action={<Button onClick={onRefresh}>重试</Button>}
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.inventoryWorkbenchScopeForbidden)}
        />
      )}
      {!scopeForbidden && failed && (
        <Alert
          type="error"
          showIcon
          title="商品工作台暂时无法获取"
          description="当前筛选和结果域已保留，请重试。"
          action={
            <Button {...testId(catalogTestIds.control.workbenchRetry)} onClick={onRefresh}>
              重试
            </Button>
          }
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.inventoryWorkbenchProblem)}
        />
      )}
      {noAuthorizedBrand && (
        <Alert
          type="info"
          showIcon
          title="当前没有可操作的品牌"
          description="当前数据节点下没有授权且启用的品牌，商品列表不会伪装成普通空结果。"
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.inventoryNoAuthorizedBrand)}
        />
      )}
      {noSelectedScope && (
        <Alert
          type="info"
          showIcon
          title="请选择管理范围"
          description={surface === 'brand' ? '请选择一个已授权品牌后再查看商品。' : '请选择一个门店后再查看商品。'}
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.inventoryScopeRequired)}
        />
      )}
      {surface === 'store' && !noSelectedScope && ruleState !== 'ENABLED' ? (
        <OperationsStoreCatalogManagementDisabledSurface
          state={ruleState as Exclude<StoreOperatingRuleGateState, 'BYPASSED' | 'SCOPE_MISSING' | 'ENABLED'>}
          onRetry={onRuleRetry}
        />
      ) : (
        <>
          <CatalogWorkbenchToolbar {...toolbarProps} />
          <div style={{display: 'flex', gap: 16, marginTop: 16, minHeight: 460}}>
            {treeVisible && <CatalogWorkbenchNavigationTree {...navigationProps} />}
            <CatalogWorkbenchItemList {...itemListProps} />
          </div>
        </>
      )}
    </section>
  );
}
