import type {AdminActionCapabilityKey} from '../../app/catalog/generatedAdminCatalog';

export type OperationsPageContext = {
  groupWorkspaceKey: string;
  expectedContextVersion: number;
  identityKey?: string;
  scopeRef?: string;
};

export type OperationsPageProps = {
  queryContext: OperationsPageContext;
  actionCapabilityKeys: readonly AdminActionCapabilityKey[];
};

export function requireOperationsScopeRef({scopeRef}: OperationsPageContext): string {
  if (typeof scopeRef !== 'string' || !scopeRef.trim()) throw new Error('OPERATIONS_DATA_NODE_SCOPE_REQUIRED');
  return scopeRef;
}
