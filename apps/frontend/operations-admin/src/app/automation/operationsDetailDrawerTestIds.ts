/**
 * Stable identities for actions in operations-admin object-detail Drawers.
 * Existing action values are retained so moving an action into a Popup Menu
 * does not change the business control identity used by existing bindings.
 */
export const operationsDetailDrawerTestIds = {
  workspaceUser: {
    actionMenu: 'operations-workspace-user-detail-action-menu',
    audit: 'operations-workspace-user-detail-audit',
  },
  workspaceInvitation: {
    actionMenu: 'operations-workspace-invitation-action-menu',
    audit: 'operations-workspace-invitation-audit-history',
    cancel: 'operations-workspace-invitation-cancel',
    reissue: 'operations-workspace-invitation-reissue',
  },
  contract: {
    actionMenu: 'operations-contract-detail-action-menu',
    audit: 'operations-contract-detail-audit-history',
    edit: 'operations-contract-detail-edit',
    invalidate: 'operations-contract-detail-invalidate',
  },
  inventory: {
    actionMenu: 'inventory-action-menu',
    count: 'inventory-action-count',
    increase: 'inventory-action-increase',
    adjust: 'inventory-action-adjust',
    configure: 'inventory-action-configure',
  },
  store: {
    actionMenu: 'operations-store-detail-action-menu',
    audit: 'operations-store-detail-audit',
    edit: 'operations-store-detail-edit',
    status: 'operations-store-detail-status',
  },
  businessChannel: {
    actionMenu: 'business-channel-action-menu',
    edit: 'business-channel-edit-open',
    binding: 'business-channel-binding',
    status: 'business-channel-status',
  },
  businessChannelTemplate: {
    actionMenu: 'business-channel-template-detail-action-menu',
    edit: 'business-channel-template-detail-edit',
    status: 'business-channel-template-detail-status',
  },
  businessEntity: {
    actionMenu: 'operations-business-entity-detail-action-menu',
    audit: 'operations-business-entity-detail-audit-history',
    edit: 'operations-business-entity-detail-edit',
    authorizeBrands: 'operations-business-entity-detail-authorize-brands',
    status: 'operations-business-entity-detail-status',
    void: 'operations-business-entity-detail-void',
  },
} as const;
