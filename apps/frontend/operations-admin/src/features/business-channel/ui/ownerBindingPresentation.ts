import {closedCodeLabel, isKnownClosedCode} from '@catering-v2s/admin-ui-foundation';
import type {OwnerBindingView, ProviderProfileView} from '../../../app/api/generated/operations-edge';
import {
  collaborationBindingStatusLabels,
  authenticationKindLabels,
  organizationNodeTypeLabels,
  capabilityClassLabels,
  providerBusinessScopeLabels,
} from '../model/collaborationCodeLabels';

export function ownerBindingBusinessDisplay(binding?: OwnerBindingView): string {
  if (!binding) return '—';
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
  binding: Pick<OwnerBindingView, 'externalOwnerId'> | undefined,
  authenticationKind?: ProviderProfileView['authenticationKind'],
): string {
  if (binding?.externalOwnerId) return binding.externalOwnerId;
  if (authenticationKind === 'EXTERNAL_GRANT') return '待外部授权回填';
  if (authenticationKind === 'NO_MAPPING') return '无需主体映射';
  if (authenticationKind !== undefined && !isKnownClosedCode(authenticationKindLabels, authenticationKind)) {
    return '当前认证方式无法识别';
  }
  return '—';
}
