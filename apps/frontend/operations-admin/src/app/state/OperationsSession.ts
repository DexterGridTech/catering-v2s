import type {AdminActionCapabilityKey} from '../catalog/generatedAdminCatalog';
import type {OperationsPageDesignKey} from '../catalog/generatedAdminCatalog';

export type OperationsSession = {
  groupWorkspaceKey: string;
  assignmentId: string | null;
  visibleDataNodeId: string | null;
  contextVersion: number;
  pageAccessKeys: OperationsPageDesignKey[];
  actionCapabilityKeys: AdminActionCapabilityKey[];
};
