import {describe, expect, it} from 'vitest';
import {
  attributeControlKindLabels,
  attributeOptionSourceLabels,
  authenticationKindLabels,
  capabilityClassLabels,
  collaborationAttributePresentation,
  collaborationBindingStatusLabels,
  collaborationCodeLabels,
  catalogStatusLabels,
  groupBuyMappingDirectionLabels,
  menuCollaborationDirectionLabels,
  organizationNodeTypeLabels,
  providerBusinessScopeLabels,
  unbindKindLabels,
} from './collaborationCodeLabels';

describe('platform collaboration code labels', () => {
  it('covers every generated collaboration enum member exactly once', () => {
    expect(Object.keys(capabilityClassLabels).sort()).toEqual([
      'DINE_IN',
      'GROUP_BUY',
      'INVENTORY_SYNC',
      'MASTER_DATA_SYNC',
      'MEMBER_BENEFIT',
      'ORDER_SYNC',
      'TAKEAWAY',
      'TAKEAWAY_DELIVERY',
    ]);
    expect(Object.keys(groupBuyMappingDirectionLabels).sort()).toEqual([
      'EXTERNAL_TO_INTERNAL',
      'INTERNAL_TO_EXTERNAL',
    ]);
    expect(Object.keys(menuCollaborationDirectionLabels)).toEqual(['PULL_ONLY']);
    expect(Object.keys(collaborationBindingStatusLabels).sort()).toEqual([
      'DELETED',
      'EFFECTIVE',
      'INVALID',
      'PENDING_AUTHORIZATION',
    ]);
    expect(Object.keys(organizationNodeTypeLabels).sort()).toEqual([
      'COMMERCIAL_GROUP',
      'HEAD_COMPANY',
      'PROJECT',
      'REGION',
      'STORE',
    ]);
    expect(Object.keys(providerBusinessScopeLabels).sort()).toEqual([
      'DINE_IN',
      'GROUP_BUY',
      'MEMBER_BENEFIT',
      'ORDER_SYNC',
      'TAKEAWAY',
    ]);
    expect(Object.keys(authenticationKindLabels).sort()).toEqual(['EXTERNAL_GRANT', 'INTERNAL_MAPPING', 'NO_MAPPING']);
    expect(Object.keys(unbindKindLabels).sort()).toEqual(['LOCAL_ONLY', 'REQUIRES_ADAPTER_UNBIND']);
    expect(Object.keys(catalogStatusLabels).sort()).toEqual(['AVAILABLE', 'PLANNED']);
    expect(Object.keys(attributeControlKindLabels).sort()).toEqual(['readonlyPreview', 'readonlySummary']);
    expect(Object.keys(attributeOptionSourceLabels).sort()).toEqual(['endpoint', 'enum', 'local']);
  });

  it('keeps the accepted attribute presentation metadata local and exhaustive', () => {
    expect(collaborationAttributePresentation.groupBuyMappingDirection.label).toBe('团购商品映射方向');
    expect(collaborationAttributePresentation.menuCollaborationDirection.optionSourceRef).toBe('enum');
    expect(collaborationCodeLabels.catalogStatus.AVAILABLE).toBe('可用');
  });
});
