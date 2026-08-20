import type {OwnerBindingView, ProviderProfileView} from '../../../app/api/generated/platform-edge';

export function ownerBindingBusinessDisplay(binding: OwnerBindingView): string {
  return (
    binding.capabilityClassDisplayName ||
    (binding.businessScopeDisplayNames.length > 0 ? binding.businessScopeDisplayNames.join('、') : '全部业务')
  );
}

export function ownerBindingExternalOwnerDisplay(
  binding: Pick<OwnerBindingView, 'externalOwnerId'>,
  authenticationKind: ProviderProfileView['authenticationKind'],
): string {
  if (binding.externalOwnerId) return binding.externalOwnerId;
  if (authenticationKind === 'EXTERNAL_GRANT') return '待外部授权回填';
  if (authenticationKind === 'NO_MAPPING') return '无需主体映射';
  return '—';
}
