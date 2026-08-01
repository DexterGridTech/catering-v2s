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
