import type {AdminActionCapabilityKey} from '../../app/catalog/generatedAdminCatalog';
import type {Uuid} from '../api/generated/operations-edge';

export type OperationsPageContext = {
  groupWorkspaceKey: string;
  expectedContextVersion: number;
  identityKey?: string;
  scopeRef?: Uuid;
};

export type OperationsPageProps = {
  queryContext: OperationsPageContext;
  actionCapabilityKeys: readonly AdminActionCapabilityKey[];
};

export function requireOperationsScopeRef({scopeRef}: OperationsPageContext): Uuid {
  if (typeof scopeRef !== 'string' || !scopeRef.trim()) throw new Error('OPERATIONS_DATA_NODE_SCOPE_REQUIRED');
  return scopeRef;
}
