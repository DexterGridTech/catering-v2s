import type {OrganizationStoreStatus} from '../../../app/api/generated/operations-edge';

export const organizationStoreStatusLabels = {
  ENABLED: '启用',
  DISABLED: '停用',
  VOIDED: '作废',
} satisfies Record<OrganizationStoreStatus, string>;

export function toggleOrganizationStoreStatus(status: OrganizationStoreStatus): 'ENABLED' | 'DISABLED' | undefined {
  if (status === 'ENABLED') return 'DISABLED';
  if (status === 'DISABLED') return 'ENABLED';
  return undefined;
}
