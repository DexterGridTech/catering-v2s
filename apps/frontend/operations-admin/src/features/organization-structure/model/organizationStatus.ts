import {LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';
import type {OrganizationStoreStatus} from '../../../app/api/generated/operations-edge';

export const organizationStoreStatusLabels = LIFECYCLE_LABELS satisfies Record<OrganizationStoreStatus, string>;

export function toggleOrganizationStoreStatus(status: OrganizationStoreStatus): 'ENABLED' | 'DISABLED' | undefined {
  if (status === 'ENABLED') return 'DISABLED';
  if (status === 'DISABLED') return 'ENABLED';
  return undefined;
}
