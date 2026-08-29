import type {OwnerBindingView, ProviderProfileView} from '../../../app/api/generated/platform-edge';
import {closedCodeLabel} from '@catering-v2s/admin-ui-foundation';
import {
  capabilityClassLabels,
  collaborationBindingStatusLabels,
  authenticationKindLabels,
  organizationNodeTypeLabels,
  providerBusinessScopeLabels,
} from '../model/collaborationCodeLabels';

export function canCreateOwnerBinding(
  profile: Pick<ProviderProfileView, 'authenticationKind' | 'enablementStatus'>,
): boolean {
  return (
    profile.enablementStatus === 'ENABLED' &&
    Object.hasOwn(authenticationKindLabels, profile.authenticationKind) &&
    ['INTERNAL_MAPPING', 'NO_MAPPING'].includes(profile.authenticationKind)
  );
}

export function ownerBindingBusinessDisplay(binding: OwnerBindingView): string {
  if (binding.capabilityClass) return closedCodeLabel(capabilityClassLabels, binding.capabilityClass);
  return binding.businessScope.length > 0
    ? binding.businessScope.map(scope => closedCodeLabel(providerBusinessScopeLabels, scope)).join('、')
    : '全部业务';
}

export function ownerBindingStatusDisplay(binding: Pick<OwnerBindingView, 'status'>): string {
  return closedCodeLabel(collaborationBindingStatusLabels, binding.status);
}

export function ownerBindingNodeTypeDisplay(binding: Pick<OwnerBindingView, 'nodeType'>): string {
  return closedCodeLabel(organizationNodeTypeLabels, binding.nodeType);
}

export function ownerBindingExternalOwnerDisplay(
  binding: Pick<OwnerBindingView, 'externalOwnerId'>,
  authenticationKind: ProviderProfileView['authenticationKind'],
): string {
  if (binding.externalOwnerId) return binding.externalOwnerId;
  if (authenticationKind === 'EXTERNAL_GRANT') return '待外部授权回填';
  if (authenticationKind === 'NO_MAPPING') return '无需主体映射';
  if (!Object.hasOwn(authenticationKindLabels, authenticationKind)) return '当前状态无法识别';
  return '—';
}
