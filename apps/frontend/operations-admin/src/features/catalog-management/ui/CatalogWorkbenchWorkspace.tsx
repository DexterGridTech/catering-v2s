import type {OperationsPageProps} from '../../../app/routing/model';
import {CatalogWorkbenchController, type CatalogSurface} from './controllers/CatalogWorkbenchController';

/**
 * First-level workbench surface only. Query, task and transient interaction
 * state each live in dedicated controllers; this host owns no business state.
 */
export function CatalogWorkbenchWorkspace({
  queryContext,
  actionCapabilityKeys,
  surface,
}: OperationsPageProps & {surface: CatalogSurface}) {
  return (
    <CatalogWorkbenchController
      queryContext={queryContext}
      actionCapabilityKeys={actionCapabilityKeys}
      surface={surface}
    />
  );
}
