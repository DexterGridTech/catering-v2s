import type {BusinessEntityStatus} from '../../../app/api/generated/operations-edge';

export const businessEntityLifecycleLabels = {
  ENABLED: '启用',
  DISABLED: '停用',
  VOIDED: '标记删除',
} satisfies Record<BusinessEntityStatus, string>;

export function canManageBusinessEntity(status: BusinessEntityStatus) {
  return status !== 'VOIDED';
}

export function toggleBusinessEntityStatus(status: BusinessEntityStatus): 'ENABLED' | 'DISABLED' | undefined {
  if (status === 'ENABLED') return 'DISABLED';
  if (status === 'DISABLED') return 'ENABLED';
  return undefined;
}

export function canVoidBusinessEntity(status: BusinessEntityStatus) {
  return status === 'ENABLED' || status === 'DISABLED';
}
