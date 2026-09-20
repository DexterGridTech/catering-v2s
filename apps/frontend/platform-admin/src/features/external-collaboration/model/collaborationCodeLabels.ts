import {
  collaborationAttributePresentation,
  collaborationAttributeValueLabel,
  collaborationCodeLabels as sharedCollaborationCodeLabels,
} from '@catering-v2s/admin-ui-foundation';
import type {ExternalCapability, OwnerBindingView, ProviderProfileView} from '../../../app/api/generated/platform-edge';

type CapabilityClass = ExternalCapability['capabilityClass'];
type GroupBuyMappingDirection = NonNullable<ExternalCapability['attributeValues']['groupBuyMappingDirection']>;
type MenuCollaborationDirection = NonNullable<ExternalCapability['attributeValues']['menuCollaborationDirection']>;
type BindingStatus = OwnerBindingView['status'];
type OrganizationNodeType = OwnerBindingView['nodeType'];
type ProviderBusinessScope = ProviderProfileView['businessScope'][number];
type AuthenticationKind = ProviderProfileView['authenticationKind'];
type UnbindKind = ProviderProfileView['unbindKind'];
type CatalogStatus = ProviderProfileView['catalogStatus'];

/** Generated unions remain app-local compile-time adapters over shared values. */
export const capabilityClassLabels = sharedCollaborationCodeLabels.capabilityClass satisfies Record<
  CapabilityClass,
  string
>;
export const groupBuyMappingDirectionLabels = sharedCollaborationCodeLabels.groupBuyMappingDirection satisfies Record<
  GroupBuyMappingDirection,
  string
>;
export const menuCollaborationDirectionLabels =
  sharedCollaborationCodeLabels.menuCollaborationDirection satisfies Record<MenuCollaborationDirection, string>;
export const collaborationBindingStatusLabels = sharedCollaborationCodeLabels.bindingStatus satisfies Record<
  BindingStatus,
  string
>;
export const organizationNodeTypeLabels = sharedCollaborationCodeLabels.organizationNodeType satisfies Record<
  OrganizationNodeType,
  string
>;
export const providerBusinessScopeLabels = sharedCollaborationCodeLabels.providerBusinessScope satisfies Record<
  ProviderBusinessScope,
  string
>;
export const authenticationKindLabels = sharedCollaborationCodeLabels.authenticationKind satisfies Record<
  AuthenticationKind,
  string
>;
export const unbindKindLabels = sharedCollaborationCodeLabels.unbindKind satisfies Record<UnbindKind, string>;
export const catalogStatusLabels = sharedCollaborationCodeLabels.catalogStatus satisfies Record<CatalogStatus, string>;
export const attributeControlKindLabels = sharedCollaborationCodeLabels.attributeControlKind;
export const attributeOptionSourceLabels = sharedCollaborationCodeLabels.attributeOptionSource;

export {collaborationAttributePresentation, collaborationAttributeValueLabel};

/** Keep the aggregate identity shared too; the named exports above are the generated adapters. */
export const collaborationCodeLabels = sharedCollaborationCodeLabels;
