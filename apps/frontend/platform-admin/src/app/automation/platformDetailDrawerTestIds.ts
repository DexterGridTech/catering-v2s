/**
 * Stable identities for actions in platform-admin object-detail Drawers.
 *
 * The values intentionally preserve the existing action IDs so existing
 * browser bindings continue to identify the same business action after it is
 * moved into the shared Popup Menu.
 */
export const platformDetailDrawerTestIds = {
  ownerBinding: {
    actionMenu: 'platform-owner-binding-action-menu',
    edit: 'platform-owner-binding-edit',
    remove: 'platform-owner-binding-delete',
  },
  contractOverview: {
    actionMenu: 'platform-contract-overview-action-menu',
    audit: 'platform-contract-audit-history',
  },
  administrator: {
    actionMenu: 'platform-admin-detail-action-menu',
    audit: 'platform-admin-detail-audit-history',
    edit: 'platform-admin-detail-edit',
    credential: 'platform-admin-detail-credential',
    status: 'platform-admin-detail-status',
  },
  invitation: {
    actionMenu: 'platform-invitation-action-menu',
    audit: 'platform-invitation-audit-open',
    cancel: (invitationId: string) => `platform-invitation-cancel-${invitationId}`,
    reissue: (invitationId: string) => `platform-invitation-reissue-${invitationId}`,
  },
  role: {
    actionMenu: 'workspace-role-action-menu',
    audit: 'workspace-role-audit-history',
    edit: 'workspace-role-edit',
    status: 'workspace-role-transition-status',
    void: 'workspace-role-void',
  },
  account: {
    actionMenu: 'workspace-account-action-menu',
    audit: 'workspace-account-audit-history',
    credential: 'workspace-account-reset-credential',
    status: 'workspace-account-transition-status',
  },
  workspace: {
    actionMenu: 'platform-workspace-action-menu',
    initialize: 'platform-workspace-initialize',
    audit: 'platform-workspace-audit-history',
    edit: 'platform-workspace-edit',
    status: 'platform-workspace-status',
  },
} as const;
