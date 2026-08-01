import {testId} from '@catering-v2s/admin-ui-foundation';
import {adminCatalog, type OperationsPageDesignKey} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';

type Props = OperationsPageProps & {pageDesignKey: OperationsPageDesignKey};

/**
 * Frozen role-home bootstrap only: it establishes the approved route and current
 * context without inventing a dashboard, metrics, task feed, or a new operation.
 */
export function RoleHomeBootstrapPage({pageDesignKey}: Props) {
  const page = adminCatalog.operationsPages.find((entry) => entry.pageDesignKey === pageDesignKey);
  if (!page) return null;
  return <div {...testId(`role-home-${pageDesignKey}`)}>v2 bootstrap 内容出口</div>;
}
