import {LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceAccountStatus, WorkspaceRoleStatus} from '../../../app/api/generated/platform-edge';

export type WorkspaceIamLifecycleStatus = WorkspaceAccountStatus | WorkspaceRoleStatus;

export const workspaceIamLifecycleLabels = LIFECYCLE_LABELS satisfies Record<WorkspaceIamLifecycleStatus, string>;

export function canManageWorkspaceIam(status: WorkspaceIamLifecycleStatus) {
  return status !== 'VOIDED';
}

export function canVoidWorkspaceIam(status: WorkspaceIamLifecycleStatus) {
  return status === 'ENABLED' || status === 'DISABLED';
}

export function toggleWorkspaceIamStatus(status: WorkspaceIamLifecycleStatus): 'ENABLED' | 'DISABLED' | undefined {
  if (status === 'ENABLED') return 'DISABLED';
  if (status === 'DISABLED') return 'ENABLED';
  return undefined;
}
