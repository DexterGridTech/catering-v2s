// Generated from accepted R5 edge catalog; do not edit.

export const PLATFORM_ADMIN_OPERATIONS = [
  {
    "operationId": "cancelWorkspaceInvitation",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "changeCurrentPlatformPassword",
    "method": "POST",
    "path": "/api/platform/auth/password",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "completePlatformPasswordRecovery",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/complete",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "createPlatformAdmin",
    "method": "POST",
    "path": "/api/platform/admin-users",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "createPlatformGroupWorkspace",
    "method": "POST",
    "path": "/api/platform/group-workspaces",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "createPlatformOwnerBinding",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "createWorkspaceInvitation",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "createWorkspaceRole",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "deletePlatformOwnerBinding",
    "method": "DELETE",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getCurrentPlatformSession",
    "method": "GET",
    "path": "/api/platform/auth/session",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "getExtensionDefinition",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
    "owner": "extension",
    "requiresSession": true
  },
  {
    "operationId": "getExtensionEntityCatalog",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions",
    "owner": "extension",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformAdminDetail",
    "method": "GET",
    "path": "/api/platform/admin-users/{platformAdminId}",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformAdminPage",
    "method": "GET",
    "path": "/api/platform/admin-users",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformContractOverviewDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformContractOverviewPage",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview",
    "owner": "contract",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformEntityAuditHistory",
    "method": "GET",
    "path": "/api/platform/audit-history",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformExternalCapabilityDictionary",
    "method": "GET",
    "path": "/api/platform/external-capability-dictionary",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformExternalCollaborationTree",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/external-collaboration",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformExternalSystemDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformGroupWorkspaceDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformOrganizationCandidates",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/candidates",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformOrganizationHierarchyTree",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformOrganizationOverviewDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformOrganizationOverviewPage",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformOwnerBindingDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformProviderProfileBindings",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/owner-bindings",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getPlatformProviderProfileDetail",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceAccount",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceAccounts",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceInvitation",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceInvitationCandidates",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitation-candidates",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceInvitations",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceRole",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "getWorkspaceRoles",
    "method": "GET",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "initializeCommercialGroup",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group",
    "owner": "organization",
    "requiresSession": true
  },
  {
    "operationId": "listPlatformGroupWorkspaces",
    "method": "GET",
    "path": "/api/platform/group-workspaces",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "platformLogout",
    "method": "POST",
    "path": "/api/platform/auth/logout",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "platformPasswordLogin",
    "method": "POST",
    "path": "/api/platform/auth/password-login",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "reissueWorkspaceInvitation",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "releasePlatformStagedAsset",
    "method": "POST",
    "path": "/api/platform/assets/staging/{assetRef}/release",
    "owner": "platform-asset",
    "requiresSession": true
  },
  {
    "operationId": "replaceExtensionDefinition",
    "method": "PUT",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
    "owner": "extension",
    "requiresSession": true
  },
  {
    "operationId": "requestWorkspaceCredentialReset",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "resetPlatformAdminCredential",
    "method": "POST",
    "path": "/api/platform/admin-users/{platformAdminId}/credential-reset",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "revokePlatformWorkspaceAssignment",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "sendPlatformLoginOtp",
    "method": "POST",
    "path": "/api/platform/auth/login-otp/send",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "sendPlatformPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/otp/send",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "stagePlatformAsset",
    "method": "POST",
    "path": "/api/platform/assets/staging",
    "owner": "platform-asset",
    "requiresSession": true
  },
  {
    "operationId": "startPlatformPasswordRecovery",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/start",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "transitionPlatformAdminStatus",
    "method": "POST",
    "path": "/api/platform/admin-users/{platformAdminId}/status",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "transitionPlatformExternalSystemStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "transitionPlatformGroupWorkspaceStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/status",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "transitionPlatformProviderProfileStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "transitionWorkspaceAccountStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "transitionWorkspaceRoleStatus",
    "method": "POST",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "updatePlatformAdminProfile",
    "method": "PATCH",
    "path": "/api/platform/admin-users/{platformAdminId}/profile",
    "owner": "platform-iam",
    "requiresSession": true
  },
  {
    "operationId": "updatePlatformGroupWorkspaceDisplay",
    "method": "PATCH",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}",
    "owner": "platform-workspace",
    "requiresSession": true
  },
  {
    "operationId": "updatePlatformOwnerBinding",
    "method": "PATCH",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
    "owner": "collaboration",
    "requiresSession": true
  },
  {
    "operationId": "updateWorkspaceRole",
    "method": "PATCH",
    "path": "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
    "owner": "workspace-iam",
    "requiresSession": true
  },
  {
    "operationId": "verifyPlatformLoginOtp",
    "method": "POST",
    "path": "/api/platform/auth/login-otp/verify",
    "owner": "platform-iam",
    "requiresSession": false
  },
  {
    "operationId": "verifyPlatformPasswordRecoveryOtp",
    "method": "POST",
    "path": "/api/platform/auth/password-recovery/otp/verify",
    "owner": "platform-iam",
    "requiresSession": false
  }
] as const;

export const PLATFORM_ADMIN_DATABASE_OPERATION_BUDGETS = {
  "cancelWorkspaceInvitation": {
    "kind": "FIXED",
    "max": 24,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 24,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "changeCurrentPlatformPassword": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "completePlatformPasswordRecovery": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createPlatformAdmin": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createPlatformGroupWorkspace": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createPlatformOwnerBinding": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "createWorkspaceInvitation": {
    "kind": "FIXED",
    "max": 26,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 26,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "createWorkspaceRole": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "deletePlatformOwnerBinding": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getCurrentPlatformSession": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getExtensionDefinition": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getExtensionEntityCatalog": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformAdminDetail": {
    "kind": "FIXED",
    "max": 5,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 5,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformAdminPage": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformContractOverviewDetail": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformContractOverviewPage": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformEntityAuditHistory": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformExternalCapabilityDictionary": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformExternalCollaborationTree": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformExternalSystemDetail": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformGroupWorkspaceDetail": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformOrganizationCandidates": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformOrganizationHierarchyTree": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformOrganizationOverviewDetail": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformOrganizationOverviewPage": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformOwnerBindingDetail": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformProviderProfileBindings": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getPlatformProviderProfileDetail": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceAccount": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceAccounts": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceInvitation": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceInvitationCandidates": {
    "kind": "FIXED",
    "max": 8,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 8,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceInvitations": {
    "kind": "FIXED",
    "max": 7,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 7,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceRole": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "getWorkspaceRoles": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "initializeCommercialGroup": {
    "kind": "FIXED",
    "max": 16,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 16,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "listPlatformGroupWorkspaces": {
    "kind": "FIXED",
    "max": 6,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 6,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "platformLogout": {
    "kind": "FIXED",
    "max": 4,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 4,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "platformPasswordLogin": {
    "kind": "FIXED",
    "max": 11,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 11,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "reissueWorkspaceInvitation": {
    "kind": "FIXED",
    "max": 30,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": 20,
        "to": 30,
        "reason": "Dexter 2026-08-29: invitation and employment-assignment commands are inherently multi-table writes; preserve their complete business transaction.",
        "decisionRef": "DEXTER-2026-08-29-BASE1-INVITATION-ASSIGNMENT-NATURAL-MULTI-TABLE-P3"
      }
    ]
  },
  "releasePlatformStagedAsset": {
    "kind": "FIXED",
    "max": 9,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 9,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "replaceExtensionDefinition": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "requestWorkspaceCredentialReset": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "resetPlatformAdminCredential": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "revokePlatformWorkspaceAssignment": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "sendPlatformLoginOtp": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "sendPlatformPasswordRecoveryOtp": {
    "kind": "FIXED",
    "max": 14,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 14,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "stagePlatformAsset": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "startPlatformPasswordRecovery": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionPlatformAdminStatus": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionPlatformExternalSystemStatus": {
    "kind": "FIXED",
    "max": 17,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 17,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionPlatformGroupWorkspaceStatus": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionPlatformProviderProfileStatus": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionWorkspaceAccountStatus": {
    "kind": "FIXED",
    "max": 20,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 20,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "transitionWorkspaceRoleStatus": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updatePlatformAdminProfile": {
    "kind": "FIXED",
    "max": 15,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 15,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updatePlatformGroupWorkspaceDisplay": {
    "kind": "FIXED",
    "max": 18,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 18,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updatePlatformOwnerBinding": {
    "kind": "FIXED",
    "max": 21,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 21,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "updateWorkspaceRole": {
    "kind": "FIXED",
    "max": 19,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 19,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "verifyPlatformLoginOtp": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  },
  "verifyPlatformPasswordRecoveryOtp": {
    "kind": "FIXED",
    "max": 13,
    "measurementScenarioIds": [
      "performance.normal-path"
    ],
    "history": [
      {
        "from": null,
        "to": 13,
        "reason": "CP-05 maximum database operation count across three runs"
      }
    ]
  }
} as const;

export const PLATFORM_ADMIN_OPERATION_IDS = {
  "cancelWorkspaceInvitation": "cancelWorkspaceInvitation",
  "changeCurrentPlatformPassword": "changeCurrentPlatformPassword",
  "completePlatformPasswordRecovery": "completePlatformPasswordRecovery",
  "createPlatformAdmin": "createPlatformAdmin",
  "createPlatformGroupWorkspace": "createPlatformGroupWorkspace",
  "createPlatformOwnerBinding": "createPlatformOwnerBinding",
  "createWorkspaceInvitation": "createWorkspaceInvitation",
  "createWorkspaceRole": "createWorkspaceRole",
  "deletePlatformOwnerBinding": "deletePlatformOwnerBinding",
  "getCurrentPlatformSession": "getCurrentPlatformSession",
  "getExtensionDefinition": "getExtensionDefinition",
  "getExtensionEntityCatalog": "getExtensionEntityCatalog",
  "getPlatformAdminDetail": "getPlatformAdminDetail",
  "getPlatformAdminPage": "getPlatformAdminPage",
  "getPlatformContractOverviewDetail": "getPlatformContractOverviewDetail",
  "getPlatformContractOverviewPage": "getPlatformContractOverviewPage",
  "getPlatformEntityAuditHistory": "getPlatformEntityAuditHistory",
  "getPlatformExternalCapabilityDictionary": "getPlatformExternalCapabilityDictionary",
  "getPlatformExternalCollaborationTree": "getPlatformExternalCollaborationTree",
  "getPlatformExternalSystemDetail": "getPlatformExternalSystemDetail",
  "getPlatformGroupWorkspaceDetail": "getPlatformGroupWorkspaceDetail",
  "getPlatformOrganizationCandidates": "getPlatformOrganizationCandidates",
  "getPlatformOrganizationHierarchyTree": "getPlatformOrganizationHierarchyTree",
  "getPlatformOrganizationOverviewDetail": "getPlatformOrganizationOverviewDetail",
  "getPlatformOrganizationOverviewPage": "getPlatformOrganizationOverviewPage",
  "getPlatformOwnerBindingDetail": "getPlatformOwnerBindingDetail",
  "getPlatformProviderProfileBindings": "getPlatformProviderProfileBindings",
  "getPlatformProviderProfileDetail": "getPlatformProviderProfileDetail",
  "getWorkspaceAccount": "getWorkspaceAccount",
  "getWorkspaceAccounts": "getWorkspaceAccounts",
  "getWorkspaceInvitation": "getWorkspaceInvitation",
  "getWorkspaceInvitationCandidates": "getWorkspaceInvitationCandidates",
  "getWorkspaceInvitations": "getWorkspaceInvitations",
  "getWorkspaceRole": "getWorkspaceRole",
  "getWorkspaceRoles": "getWorkspaceRoles",
  "initializeCommercialGroup": "initializeCommercialGroup",
  "listPlatformGroupWorkspaces": "listPlatformGroupWorkspaces",
  "platformLogout": "platformLogout",
  "platformPasswordLogin": "platformPasswordLogin",
  "reissueWorkspaceInvitation": "reissueWorkspaceInvitation",
  "releasePlatformStagedAsset": "releasePlatformStagedAsset",
  "replaceExtensionDefinition": "replaceExtensionDefinition",
  "requestWorkspaceCredentialReset": "requestWorkspaceCredentialReset",
  "resetPlatformAdminCredential": "resetPlatformAdminCredential",
  "revokePlatformWorkspaceAssignment": "revokePlatformWorkspaceAssignment",
  "sendPlatformLoginOtp": "sendPlatformLoginOtp",
  "sendPlatformPasswordRecoveryOtp": "sendPlatformPasswordRecoveryOtp",
  "stagePlatformAsset": "stagePlatformAsset",
  "startPlatformPasswordRecovery": "startPlatformPasswordRecovery",
  "transitionPlatformAdminStatus": "transitionPlatformAdminStatus",
  "transitionPlatformExternalSystemStatus": "transitionPlatformExternalSystemStatus",
  "transitionPlatformGroupWorkspaceStatus": "transitionPlatformGroupWorkspaceStatus",
  "transitionPlatformProviderProfileStatus": "transitionPlatformProviderProfileStatus",
  "transitionWorkspaceAccountStatus": "transitionWorkspaceAccountStatus",
  "transitionWorkspaceRoleStatus": "transitionWorkspaceRoleStatus",
  "updatePlatformAdminProfile": "updatePlatformAdminProfile",
  "updatePlatformGroupWorkspaceDisplay": "updatePlatformGroupWorkspaceDisplay",
  "updatePlatformOwnerBinding": "updatePlatformOwnerBinding",
  "updateWorkspaceRole": "updateWorkspaceRole",
  "verifyPlatformLoginOtp": "verifyPlatformLoginOtp",
  "verifyPlatformPasswordRecoveryOtp": "verifyPlatformPasswordRecoveryOtp"
} as const;

export const EDGE_PROBLEM_CODES = [
  "ADAPTER_UNBIND_REQUIRED",
  "AUTHORIZATION_REQUIRED",
  "BINDING_EDIT_NOT_ALLOWED",
  "COMMERCIAL_GROUP_ALREADY_INITIALIZED",
  "DELETE_NOT_ALLOWED",
  "EXTENSION_DEFINITION_INVALID",
  "EXTENSION_DEFINITION_REVISION_STALE",
  "EXTENSION_DEFINITION_VERSION_CONFLICT",
  "EXTENSION_FILTER_INVALID",
  "EXTERNAL_OWNER_ID_MISMATCH",
  "GROUP_WORKSPACE_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "IMMUTABLE_FIELD",
  "INVALID_EDGE_CONTEXT",
  "NODE_TYPE_NOT_BINDABLE",
  "PLATFORM_ASSET_BIND_CONFLICT",
  "PLATFORM_COMMON_ACCESS_DENIED",
  "PLATFORM_COMMON_AUTHENTICATION_REQUIRED",
  "PLATFORM_COMMON_CONTEXT_STALE",
  "PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED",
  "PLATFORM_COMMON_IDEMPOTENCY_CONFLICT",
  "PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION",
  "PLATFORM_COMMON_RESOURCE_NOT_FOUND",
  "PLATFORM_COMMON_RESULT_UNKNOWN",
  "PLATFORM_COMMON_VALIDATION_FAILED",
  "PLATFORM_COMMON_VERSION_CONFLICT",
  "PLATFORM_IAM_ACCOUNT_DISABLED",
  "PLATFORM_IAM_CREDENTIAL_LOCKED",
  "PLATFORM_IAM_INVALID_CREDENTIALS",
  "PLATFORM_IAM_LOGIN_NAME_CONFLICT",
  "PLATFORM_IAM_RATE_LIMITED",
  "PLATFORM_IAM_RESULT_UNKNOWN",
  "PLATFORM_IAM_SESSION_EXPIRED",
  "PLATFORM_WORKSPACE_KEY_CONFLICT",
  "PLATFORM_WORKSPACE_NAME_CONFLICT",
  "PLATFORM_WORKSPACE_STATUS_TRANSITION_INVALID",
  "PROVIDER_NOT_ENABLED",
  "UNKNOWN_SUBMISSION_RESULT",
  "VALIDATION_FAILED",
  "VERSION_CONFLICT",
  "WORKSPACE_IAM_ACCOUNT_STATUS_TRANSITION_INVALID",
  "WORKSPACE_IAM_ACCOUNT_VERSION_CONFLICT",
  "WORKSPACE_IAM_ASSIGNMENT_NOT_ACTIVE",
  "WORKSPACE_IAM_ASSIGNMENT_VERSION_CONFLICT",
  "WORKSPACE_IAM_CREDENTIAL_RESET_UNAVAILABLE",
  "WORKSPACE_IAM_PAGE_ACCESS_CATALOG_MISMATCH",
  "WORKSPACE_IAM_ROLE_CAPABILITY_CATALOG_DRIFT",
  "WORKSPACE_IAM_ROLE_CAPABILITY_INCOMPATIBLE",
  "WORKSPACE_IAM_ROLE_CAPABILITY_UNKNOWN",
  "WORKSPACE_IAM_ROLE_NAME_CONFLICT",
  "WORKSPACE_IAM_ROLE_SERVICE_NODE_TYPE_UNSUPPORTED",
  "WORKSPACE_IAM_ROLE_STATUS_TRANSITION_INVALID",
  "WORKSPACE_IAM_ROLE_VERSION_CONFLICT"
] as const;
export type EdgeProblemCode = (typeof EDGE_PROBLEM_CODES)[number];
export type PlatformAdminOperationId = (typeof PLATFORM_ADMIN_OPERATIONS)[number]["operationId"];

export type JsonValue = string | number | boolean | null | Array<JsonValue> | { [key: string]: JsonValue };

export type Uuid = string & { readonly __uuid: "Uuid" };

export type AuditChange = {
  fieldKey: string;
  fieldLabelSnapshot?: (string) | null;
  beforeState?: AuditValueState;
  beforeValue?: (string) | null;
  afterState?: AuditValueState;
  afterValue?: (string) | null;
};

export type AuditHistoryItem = {
  id: string & { readonly __uuid: "Uuid" };
  occurredAt: EpochMillis;
  actorDisplayName: string;
  actionSummary: string;
  action: string;
  target: AuditTarget;
  changes: Array<AuditChange>;
};

export type AuditHistoryPage = {
  items: Array<AuditHistoryItem>;
  page: number;
  pageSize: number;
  total: number;
};

export type AuditTarget = {
  entityType: string;
  entityId: string;
};

export type AuditValueState = "MISSING" | "NULL" | "CLEARED" | "VALUE";

export type CapabilityDictionary = {
  externalSystems: Array<ExternalSystemView>;
  providerProfiles: Array<ProviderProfileView>;
};

export type CommercialGroupInitializeRequest = {
  groupCode: string;
  groupName: string;
  idempotencyKey: string;
  extensionValues?: (Record<string, JsonValue>) | null;
};

export type CommercialGroupRoot = {
  id: string;
  groupWorkspaceKey: string;
  groupCode: string;
  groupName: string;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
};

export type ContractOverviewItem = {
  contractRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  storeRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  phaseName: (string) | null;
  tenantRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  effectiveFrom?: string;
  effectiveTo?: string;
  note?: (string) | null;
  status: StoreContractStatus;
  source: "MANUAL";
  revision: number;
  createdAt: number;
  updatedAt: number;
  storeResolutionStatus: "RESOLVED" | "UNRESOLVED";
  tenantResolutionStatus: "RESOLVED" | "UNRESOLVED";
  projectRef: {
  id: string;
  code: string;
  name: string;
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
};
  items: Array<StoreContractItem>;
  extensionValues: Record<string, JsonValue>;
  extensionRuleRevision: number;
};

export type ContractOverviewPage = {
  metadata: {
  groupWorkspaceKey: string;
  page: number;
  pageSize: number;
  total: number;
  sort: StoreContractSortKey;
  direction: StoreContractSortDirection;
  definitionRevision?: (number) | null;
};
  items: Array<ContractOverviewItem>;
  itemsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  itemsAsOf: (number) | null;
  itemsUnresolved: Array<string>;
  filterOptions: Array<{
  kind: "STORE" | "TENANT";
  id: string;
  name: string;
}>;
  filterOptionsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  filterOptionsAsOf: (number) | null;
  filterOptionsUnresolved: Array<string>;
};

export type EpochMillis = number;

export type ExtensionDefinition = {
  groupWorkspaceKey: string;
  entityType: ExtensionEntityType;
  definitions: Array<{
  key: string;
  label: string;
  type: ExtensionFieldType;
  listDisplay: (boolean) | null;
  searchable: (boolean) | null;
  required: boolean;
  options: Array<string>;
  status: "ENABLED" | "DISABLED";
  displayOrder?: number;
  displaySuffix?: (string) | null;
}>;
  revision: number;
  updatedAt: EpochMillis;
  workspaceStatus: GroupWorkspaceStatus;
  blockers: Array<ExtensionDefinitionBlocker>;
};

export type ExtensionDefinitionBlocker = {
  type: "WORKSPACE";
  status: GroupWorkspaceStatus;
};

export type ExtensionDefinitionUpdateRequest = {
  definitions: Array<{
  key?: string;
  label: string;
  type: ExtensionFieldType;
  listDisplay: (boolean) | null;
  searchable: (boolean) | null;
  required: boolean;
  options: Array<string>;
  status: "ENABLED" | "DISABLED";
  displayOrder?: number;
  displaySuffix?: (string) | null;
}>;
  expectedVersion: number;
};

export type ExtensionEntityCatalogPage = {
  items: Array<{
  entityType: ExtensionEntityType;
  displayName: string;
  configuredFieldCount: number;
  updatedAt: EpochMillis;
}>;
};

export type ExtensionEntityType = "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE" | "CONTRACT" | "COMMERCIAL_GROUP" | "REGION" | "PROJECT";

export type ExtensionFieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";

export type ExtensionFilter = {
  fieldKey: string;
  type: ExtensionFieldType;
  value: string;
};

export type ExtensionFilterQuery = string;

export type ExternalCapability = {
  capabilityClass: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC";
  displayName: string;
  attributeValues: {
  groupBuyMappingDirection?: "EXTERNAL_TO_INTERNAL" | "INTERNAL_TO_EXTERNAL";
  menuCollaborationDirection?: "PULL_ONLY";
};
};

export type ExternalCollaborationTree = {
  externalSystems: Array<ExternalSystemView>;
  providerProfiles: Array<ProviderProfileView>;
};

export type ExternalSystemStatusRequest = {
  status: "ENABLED" | "DISABLED";
  expectedVersion: number;
};

export type ExternalSystemView = {
  externalSystemCode: string;
  displayName: string;
  catalogStatus: "PLANNED" | "AVAILABLE";
  capabilities: Array<ExternalCapability>;
  enablementStatus: "ENABLED" | "DISABLED";
  version: number;
};

export type GroupWorkspaceCreateRequest = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef: string & { readonly __uuid: "Uuid" };
  logoBindGrant: string;
  notes?: string;
  idempotencyKey: string;
};

export type GroupWorkspaceCreateResult = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef: string & { readonly __uuid: "Uuid" };
  notes?: (string) | null;
  status: GroupWorkspaceStatus;
  statusChangedAt?: (number) | null;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type GroupWorkspaceDetail = {
  groupWorkspaceKey: string;
  name: string;
  operationsTitle: string;
  logoAssetRef?: (string & { readonly __uuid: "Uuid" }) | null;
  logoUrl?: (string) | null;
  notes?: (string) | null;
  status: GroupWorkspaceStatus;
  statusChangedAt?: (number) | null;
  version: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  commercialGroup?: {
  initialized: boolean;
  root?: ((CommercialGroupRoot)) | null;
};
  workspaceSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  workspaceAsOf?: EpochMillis;
  workspaceUnresolved?: (string) | null;
  initializationSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  initializationAsOf?: EpochMillis;
  initializationUnresolved?: (string) | null;
  accountAccessSourceStatus?: "AVAILABLE" | "UNAVAILABLE";
  accountAccessAsOf?: EpochMillis;
  accountAccessUnresolved?: (string) | null;
  accountCount?: (number) | null;
  roleCount?: (number) | null;
};

export type GroupWorkspaceDisplayUpdateRequest = {
  name: string;
  operationsTitle: string;
  notes?: (string) | null;
  logoIntent: "KEEP" | "REPLACE" | "REMOVE";
  logoAssetRef?: (string & { readonly __uuid: "Uuid" }) | null;
  logoBindGrant?: (string) | null;
  expectedVersion: number;
  idempotencyKey: string;
};

export type GroupWorkspacePage = {
  items: Array<{
  groupWorkspaceKey: string;
  name: string;
  operationsTitle?: (string) | null;
  logoAssetRef?: (string & { readonly __uuid: "Uuid" }) | null;
  logoUrl?: (string) | null;
  commercialGroup?: {
  initialized: boolean;
  root?: ((CommercialGroupRoot)) | null;
};
  status: GroupWorkspaceStatus;
  updatedAt: EpochMillis;
}>;
  page: number;
  pageSize: number;
  total: number;
  sortKey: GroupWorkspaceSortKey;
  sortDirection: SortDirection;
};

export type GroupWorkspaceSortKey = "NAME" | "WORKSPACE_KEY" | "UPDATED_AT";

export type GroupWorkspaceStatus = "ENABLED" | "DISABLED";

export type GroupWorkspaceStatusTransitionRequest = {
  targetStatus: GroupWorkspaceStatus;
  expectedVersion: number;
  idempotencyKey: string;
};

export type InvitationRouteFacts = {
  groupWorkspaceKey: string;
  invitationToken: string;
};

export type LoginRequest = {
  accountName: string;
  password: string;
};

export type NoBody = Record<string, never>;

export type NoContent = null;

export type OrganizationCandidatePage = {
  metadata: OrganizationCandidatePageMetadata;
  items: Array<OrganizationCandidatePageItemsItem>;
};

export type OrganizationCandidatePageItemsItem = {
  id: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
};

export type OrganizationCandidatePageMetadata = {
  subjectType: OrganizationCandidateQuerySubjectType;
  queryText: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedId: (string & { readonly __uuid: "Uuid" }) | null;
};

export type OrganizationCandidateQuerySubjectType = "COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE";

export type OrganizationHierarchyTree = {
  groupCode: string;
  groupName: string;
  regions: Array<OrganizationHierarchyTreeNode>;
};

export type OrganizationHierarchyTreeNode = {
  id: string & { readonly __uuid: "Uuid" };
  type: "REGION" | "PROJECT";
  code: string;
  name: string;
  status: OrganizationOverviewStatus;
  notes?: (string) | null;
  updatedAt: number;
  children: Array<OrganizationHierarchyTreeNode>;
  phases: Array<string>;
};

export type OrganizationOverviewCategory = "HIERARCHY" | "BUSINESS_ENTITY" | "STORE";

export type OrganizationOverviewItem = {
  id: string;
  groupWorkspaceKey: string;
  category: OrganizationOverviewCategory;
  type: OrganizationOverviewType;
  code: string;
  name: string;
  path: Array<{
  id: string;
  code: string;
  name: string;
  resolved: boolean;
}>;
  status: OrganizationOverviewStatus;
  source: OrganizationOverviewSource;
  version: number;
  createdAt: number;
  updatedAt: number;
  notes?: (string) | null;
  project?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  brand?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  tenant?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  headCompany?: {
  id: string;
  code: string;
  name: string;
  resolved: boolean;
};
  unresolvedReferences?: Array<string>;
  alias?: (string) | null;
  legalName?: (string) | null;
  unifiedSocialCreditCode?: (string) | null;
  extensionFields?: (Array<{
  name: string;
  value?: (string) | null;
}>) | null;
  extensionValues?: (Record<string, JsonValue>) | null;
  extensionRuleRevision?: (number) | null;
};

export type OrganizationOverviewPage = {
  metadata: {
  groupWorkspaceKey: string;
  category: OrganizationOverviewCategory;
  page: number;
  pageSize: number;
  total: number;
  sort: OrganizationOverviewSortKey;
  direction: OrganizationOverviewSortDirection;
  definitionRevision?: (number) | null;
};
  items: Array<OrganizationOverviewItem>;
  itemsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  itemsAsOf: (number) | null;
  itemsUnresolved: Array<string>;
  filterOptions: Array<{
  kind: "PROJECT" | "BRAND" | "TENANT";
  id: string;
  code: string;
  name: string;
}>;
  filterOptionsSourceStatus: "AVAILABLE" | "UNAVAILABLE";
  filterOptionsAsOf: (number) | null;
  filterOptionsUnresolved: Array<string>;
};

export type OrganizationOverviewSortDirection = "ASC" | "DESC";

export type OrganizationOverviewSortKey = "NAME" | "CODE" | "UPDATED_AT";

export type OrganizationOverviewSource = "MANUAL" | "SYSTEM";

export type OrganizationOverviewStatus = "ENABLED" | "DISABLED";

export type OrganizationOverviewType = "GROUP" | "REGION" | "PROJECT" | "BRAND" | "TENANT" | "HEAD_COMPANY" | "STORE";

export type OrganizationPathNode = {
  ref: string & { readonly __uuid: "Uuid" };
  code: string;
  name: string;
  nodeType: ServiceNodeType;
};

export type OwnerBindingCreateRequest = {
  providerCode: string;
  capabilityClass?: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC" | null | null;
  nodeType: string;
  nodeRef: string & { readonly __uuid: "Uuid" };
  bindingDisplayName?: string | null;
  externalOwnerId?: string | null;
};

export type OwnerBindingDeleteRequest = {
  expectedVersion: number;
};

export type OwnerBindingPage = {
  metadata: {
  bindingName: string | null;
  nodeQueryText: string | null;
  sortKey: "BINDING_NAME" | "NODE" | "BUSINESS" | "EXTERNAL_OWNER_ID" | "STATUS" | null | null;
  sortDirection: "ASC" | "DESC" | null | null;
  page: number;
  pageSize: number;
  total: number;
};
  items: Array<OwnerBindingView>;
};

export type OwnerBindingUpdateRequest = {
  bindingDisplayName: string | null;
  externalOwnerId?: string | null;
  expectedVersion: number;
};

export type OwnerBindingView = {
  bindingRef: string & { readonly __uuid: "Uuid" };
  providerCode: string;
  providerDisplayName: string;
  capabilityClass?: "MASTER_DATA_SYNC" | "MEMBER_BENEFIT" | "GROUP_BUY" | "TAKEAWAY" | "DINE_IN" | "INVENTORY_SYNC" | "TAKEAWAY_DELIVERY" | "ORDER_SYNC" | null | null;
  businessScope: Array<"TAKEAWAY" | "DINE_IN" | "GROUP_BUY" | "ORDER_SYNC" | "MEMBER_BENEFIT">;
  nodeType: "COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  nodeRef: string & { readonly __uuid: "Uuid" };
  nodePath: Array<OrganizationPathNode>;
  bindingDisplayName?: string | null;
  externalOwnerId?: string | null;
  boundAt: number;
  statusChangedAt: number;
  status: "PENDING_AUTHORIZATION" | "EFFECTIVE" | "INVALID" | "DELETED";
  version: number;
};

export type PlatformAdminCreateRequest = {
  loginName: string;
  userName: string;
  mobile?: (string) | null;
  password: string;
  idempotencyKey: string;
};

export type PlatformAdminCredentialResetRequest = {
  password: string;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAdminDetail = {
  id: string & { readonly __uuid: "Uuid" };
  userName: string;
  loginName: string;
  builtIn: boolean;
  mobile?: (string) | null;
  maskedMobile?: (string) | null;
  status: PlatformAdminStatus;
  credentialStatus: "SET";
  lastLoginAt?: (EpochMillis) | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  version: number;
  auditSummary: string;
};

export type PlatformAdminPage = {
  items: Array<{
  id: string & { readonly __uuid: "Uuid" };
  userName: string;
  loginName: string;
  builtIn: boolean;
  status: PlatformAdminStatus;
  lastLoginAt?: (EpochMillis) | null;
  updatedAt: EpochMillis;
  version: number;
}>;
  page: number;
  pageSize: number;
  total: number;
  sortKey: PlatformAdminSortKey;
  sortDirection: SortDirection;
};

export type PlatformAdminProfileUpdateRequest = {
  userName: string;
  mobile?: (string) | null;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAdminSortKey = "USER_NAME" | "LOGIN_NAME" | "LAST_LOGIN_AT" | "UPDATED_AT";

export type PlatformAdminStatus = "ACTIVE" | "DISABLED";

export type PlatformAdminStatusTransitionRequest = {
  targetStatus: PlatformAdminStatus;
  expectedVersion: number;
  idempotencyKey: string;
};

export type PlatformAssetStageMultipart = {
  usage: "GROUP_WORKSPACE_LOGO";
  groupWorkspaceKey?: string;
  file: Blob;
};

export type PlatformAssetStagingResult = {
  assetRef: string & { readonly __uuid: "Uuid" };
  bindGrant: string;
  expiresAt: EpochMillis;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256: string;
};

export type PlatformCurrentPasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
  expectedSessionVersion: number;
};

export type PlatformCurrentPasswordChangeResult = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
  reauthenticationRequired: boolean;
};

export type PlatformLoginOtpSendRequest = {
  mobile: string;
};

export type PlatformLoginOtpVerifyRequest = {
  mobile: string;
  code: string;
};

export type PlatformOtpDispatchResponse = {
  expiresAt: number;
  debugVerificationCode?: (string) | null;
};

export type PlatformPasswordRecoveryCompleteRequest = {
  newPassword: string;
};

export type PlatformPasswordRecoveryCompletion = {
  status: "COMPLETED";
  sessionsRevoked: boolean;
  reauthenticationRequired: boolean;
};

export type PlatformPasswordRecoveryOtpSendRequest = Record<string, never>;

export type PlatformPasswordRecoveryOtpVerifyRequest = {
  code: string;
};

export type PlatformPasswordRecoveryStartRequest = {
  loginName: string;
  mobile: string;
};

export type PlatformPasswordRecoveryStartResponse = {
  status: "OTP_REQUIRED";
};

export type PlatformPasswordRecoveryVerification = {
  status: "PASSWORD_REQUIRED";
};

export type PlatformSessionView = {
  sessionId: string & { readonly __uuid: "Uuid" };
  displayName: string;
  capabilities: Array<"platform.admin.access" | "platform.workspace.initialize">;
  platformAdminAccessible: boolean;
  sessionVersion: number;
};

export type PlatformWorkspaceInvitation = {
  id: string;
  groupWorkspaceKey: string;
  mobile: string;
  issuerDisplayName: string;
  targetOrganizationType: ServiceNodeType;
  roleNames: Array<string>;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
  revision: number;
  createdAt: EpochMillis;
  consentedAt?: (EpochMillis) | null;
  completedAt?: (EpochMillis) | null;
  cancelledAt?: (EpochMillis) | null;
  targetOrganizationPathNodes: Array<OrganizationPathNode>;
  invitationRouteFacts: (InvitationRouteFacts) | null;
};

export type PlatformWorkspaceInvitationPage = {
  items: Array<PlatformWorkspaceInvitation>;
  page: number;
  pageSize: number;
  total: number;
  criteria: {
  mobile?: (string) | null;
  targetOrganizationType?: (ServiceNodeType) | null;
  targetOrganizationRef?: (string & { readonly __uuid: "Uuid" }) | null;
  roleId?: (string & { readonly __uuid: "Uuid" }) | null;
  status?: (WorkspaceInvitationStatus) | null;
  expiresFrom?: (EpochMillis) | null;
  expiresTo?: (EpochMillis) | null;
  sort: WorkspaceInvitationSortKey;
  direction: SortDirection;
};
};

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: (string) | null;
  errorCode: EdgeProblemCode;
  correlationId: string;
};

export type ProviderProfileStatusRequest = ExternalSystemStatusRequest;

export type ProviderProfileView = {
  providerCode: string;
  displayName: string;
  externalSystemCode: string;
  externalSystemDisplayName: string;
  businessScope: Array<"TAKEAWAY" | "DINE_IN" | "GROUP_BUY" | "ORDER_SYNC" | "MEMBER_BENEFIT">;
  bindableNodeTypes: Array<"COMMERCIAL_GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE">;
  authenticationKind: "EXTERNAL_GRANT" | "INTERNAL_MAPPING" | "NO_MAPPING";
  unbindKind: "LOCAL_ONLY" | "REQUIRES_ADAPTER_UNBIND";
  catalogStatus: "PLANNED" | "AVAILABLE";
  enablementStatus: "ENABLED" | "DISABLED";
  version: number;
};

export type ServiceNodeType = "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";

export type SortDirection = "ASC" | "DESC";

export type StoreContractItem = {
  code: string;
  name: string;
};

export type StoreContractSortDirection = "ASC" | "DESC";

export type StoreContractSortKey = "CONTRACT_NO" | "EFFECTIVE_FROM" | "UPDATED_AT";

export type StoreContractStatus = "VALID" | "INVALID";

export type WorkspaceAccount = {
  id: string;
  groupWorkspaceKey: string;
  displayName: string;
  mobile: string;
  loginName: string;
  status: WorkspaceAccountStatus;
  credentialStatus: "SET" | "CHANGE_REQUIRED";
  activeAssignmentCount: number;
  lastLoginAt?: (EpochMillis) | null;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
  revision: number;
  assignments: Array<{
  id: string;
  serviceNodeType: ServiceNodeType;
  organizationPathNodes: Array<OrganizationPathNode>;
  roleName: string;
  status: "ACTIVE" | "REVOKED";
  source: "INVITATION" | "ADMINISTRATION";
  revision: number;
}>;
  invitationHistory: Array<{
  invitationId: string;
  status: WorkspaceInvitationStatus;
  generation: number;
  expiresAt: EpochMillis;
}>;
  authenticationHistory: Array<{
  authenticatedAt: EpochMillis;
}>;
};

export type WorkspaceAccountPage = {
  items: Array<WorkspaceAccount>;
  page: number;
  pageSize: number;
  total: number;
  sort: WorkspacePlatformAccountSortKey;
  direction: SortDirection;
};

export type WorkspaceAccountStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type WorkspaceAccountStatusTransitionRequest = {
  targetStatus: WorkspaceAccountStatus;
  expectedVersion: number;
};

export type WorkspaceAssignmentRevokeRequest = {
  expectedVersion: number;
};

export type WorkspaceAssignmentRevokeResult = {
  assignmentId: string & { readonly __uuid: "Uuid" };
  status: "REVOKED";
  version: number;
  revokedAt: number;
};

export type WorkspaceCredentialResetRequest = {
  expectedVersion: number;
};

export type WorkspaceCredentialResetResult = {
  accountId: string;
  loginName: string;
  status: WorkspaceAccountStatus;
  credentialStatus: "CHANGE_REQUIRED";
  revision: number;
  sessionsRevoked: boolean;
};

export type WorkspaceInvitationCancelRequest = {
  expectedVersion: number;
};

export type WorkspaceInvitationCandidatePage = {
  organizations: Array<{
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  organizationRef: string & { readonly __uuid: "Uuid" };
  path: string;
  pathNodes: Array<OrganizationPathNode>;
}>;
  roles: Array<WorkspaceRole>;
  metadata: ({
  subjectType: string;
  queryText?: (string) | null;
  page: number;
  pageSize: number;
  total: number;
  selectedOrganizationRef?: (string & { readonly __uuid: "Uuid" }) | null;
}) | null;
};

export type WorkspaceInvitationCreateRequest = {
  mobile: string;
  targetOrganizationType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  targetOrganizationRef: string & { readonly __uuid: "Uuid" };
  roleIds: Array<string>;
};

export type WorkspaceInvitationReissueRequest = {
  expectedVersion: number;
};

export type WorkspaceInvitationSortKey = "CREATED_AT" | "EXPIRES_AT";

export type WorkspaceInvitationStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "COMPLETED";

export type WorkspacePlatformAccountSortKey = "DISPLAY_NAME" | "LOGIN_NAME" | "LAST_LOGIN_AT" | "UPDATED_AT";

export type WorkspaceRole = {
  id: string;
  groupWorkspaceKey: string;
  name: string;
  description?: (string) | null;
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
  status: WorkspaceRoleStatus;
  revision: number;
  createdAt: EpochMillis;
  updatedAt: EpochMillis;
};

export type WorkspaceRoleCreateRequest = {
  name: string;
  description?: (string) | null;
  serviceNodeType: "GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE";
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
};

export type WorkspaceRolePage = {
  items: Array<WorkspaceRole>;
  page: number;
  pageSize: number;
  total: number;
  capabilityCatalog: Array<{
  key: "BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE";
  actionGroupKey: string;
  actionGroupLabel: string;
  actionGroupOrder: number;
  label: string;
  description: string;
  organizationTypes: Array<"GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE">;
}>;
  pageAccessCatalog: Array<{
  pageDesignKey: string;
  title: string;
  menuGroup: string;
  menuOrder: number;
  requiredDataNodeType: "NONE" | "REGION" | "PROJECT" | "STORE" | "HEAD_COMPANY";
  eligibleOrganizationTypes: Array<"GROUP" | "REGION" | "PROJECT" | "HEAD_COMPANY" | "STORE">;
}>;
};

export type WorkspaceRoleSortKey = "NAME" | "UPDATED_AT";

export type WorkspaceRoleStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type WorkspaceRoleStatusTransitionRequest = {
  targetStatus: WorkspaceRoleStatus;
  expectedVersion: number;
};

export type WorkspaceRoleUpdateRequest = {
  name: string;
  description?: (string) | null;
  capabilityKeys: Array<"BC-ORG-GROUP-EDIT" | "BC-ORG-GROUP-STATUS" | "BC-ORG-REGION-CREATE" | "BC-ORG-REGION-EDIT" | "BC-ORG-REGION-STATUS" | "BC-ORG-PROJECT-CREATE" | "BC-ORG-PROJECT-EDIT" | "BC-ORG-PROJECT-STATUS" | "BC-ORG-BRAND-CREATE" | "BC-ORG-BRAND-EDIT" | "BC-ORG-BRAND-STATUS" | "BC-ORG-TENANT-CREATE" | "BC-ORG-TENANT-EDIT" | "BC-ORG-TENANT-STATUS" | "BC-ORG-HEAD-COMPANY-CREATE" | "BC-ORG-HEAD-COMPANY-EDIT" | "BC-ORG-HEAD-COMPANY-STATUS" | "BC-ORG-HEAD-COMPANY-BRAND" | "BC-ORG-STORE-CREATE" | "BC-ORG-STORE-EDIT" | "BC-ORG-STORE-STATUS" | "BC-IAM-GROUP-ROLE-REVOKE" | "BC-IAM-REGION-ROLE-REVOKE" | "BC-IAM-PROJECT-ROLE-REVOKE" | "BC-IAM-HEAD-COMPANY-ROLE-REVOKE" | "BC-IAM-STORE-ROLE-REVOKE" | "BC-IAM-GROUP-INVITE" | "BC-IAM-REGION-INVITE" | "BC-IAM-PROJECT-INVITE" | "BC-IAM-HEAD-COMPANY-INVITE" | "BC-IAM-STORE-INVITE" | "BC-CONTRACT-CREATE" | "BC-CONTRACT-EDIT" | "BC-CONTRACT-INVALIDATE">;
  pageAccessKeys: Array<string>;
  expectedVersion: number;
};

export type FaceOperationContracts = {
  "cancelWorkspaceInvitation": {
    request: WorkspaceInvitationCancelRequest;
    response: PlatformWorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "changeCurrentPlatformPassword": {
    request: PlatformCurrentPasswordChangeRequest;
    response: PlatformCurrentPasswordChangeResult;
    requestRequired: true;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "completePlatformPasswordRecovery": {
    request: PlatformPasswordRecoveryCompleteRequest;
    response: PlatformPasswordRecoveryCompletion;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createPlatformAdmin": {
    request: PlatformAdminCreateRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createPlatformGroupWorkspace": {
    request: GroupWorkspaceCreateRequest;
    response: GroupWorkspaceCreateResult;
    requestRequired: true;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createPlatformOwnerBinding": {
    request: OwnerBindingCreateRequest;
    response: OwnerBindingView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createWorkspaceInvitation": {
    request: WorkspaceInvitationCreateRequest;
    response: PlatformWorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "createWorkspaceRole": {
    request: WorkspaceRoleCreateRequest;
    response: WorkspaceRole;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "deletePlatformOwnerBinding": {
    request: OwnerBindingDeleteRequest;
    response: OwnerBindingView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    bindingRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "getCurrentPlatformSession": {
    request: NoBody;
    response: PlatformSessionView;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getExtensionDefinition": {
    request: NoBody;
    response: ExtensionDefinition;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    entityType: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getExtensionEntityCatalog": {
    request: NoBody;
    response: ExtensionEntityCatalogPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformAdminDetail": {
    request: NoBody;
    response: PlatformAdminDetail;
    requestRequired: false;
    requiresSession: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformAdminPage": {
    request: NoBody;
    response: PlatformAdminPage;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: {
    userName?: string;
    loginName?: string;
    status?: PlatformAdminStatus;
    page?: number;
    pageSize?: number;
    sortKey?: PlatformAdminSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformContractOverviewDetail": {
    request: NoBody;
    response: ContractOverviewItem;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    contractId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformContractOverviewPage": {
    request: NoBody;
    response: ContractOverviewPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    storeId?: string & { readonly __uuid: "Uuid" };
    contractNo?: string;
    phaseName?: string;
    tenantId?: string & { readonly __uuid: "Uuid" };
    itemCode?: string;
    status?: StoreContractStatus;
    sort?: StoreContractSortKey;
    direction?: StoreContractSortDirection;
    page?: number;
    pageSize?: number;
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformEntityAuditHistory": {
    request: NoBody;
    response: AuditHistoryPage;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: {
    groupWorkspaceKey?: string;
    entityType: "GROUP_WORKSPACE" | "PLATFORM_ADMIN" | "WORKSPACE_ROLE" | "WORKSPACE_ACCOUNT" | "WORKSPACE_INVITATION" | "EXTENSION_DEFINITION" | "STORE_CONTRACT";
    entityId: string;
    page?: number;
    pageSize?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformExternalCapabilityDictionary": {
    request: NoBody;
    response: CapabilityDictionary;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformExternalCollaborationTree": {
    request: NoBody;
    response: ExternalCollaborationTree;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformExternalSystemDetail": {
    request: NoBody;
    response: ExternalSystemView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    externalSystemCode: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformGroupWorkspaceDetail": {
    request: NoBody;
    response: GroupWorkspaceDetail;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationCandidates": {
    request: NoBody;
    response: OrganizationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    subjectType: OrganizationCandidateQuerySubjectType;
    candidateUsage?: "CONTRACT_LIST" | "EXTERNAL_BINDING";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedId?: string & { readonly __uuid: "Uuid" };
    projectId?: string & { readonly __uuid: "Uuid" };
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationHierarchyTree": {
    request: NoBody;
    response: OrganizationHierarchyTree;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationOverviewDetail": {
    request: NoBody;
    response: OrganizationOverviewItem;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    category: string;
    itemId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOrganizationOverviewPage": {
    request: NoBody;
    response: OrganizationOverviewPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    category: OrganizationOverviewCategory;
    type?: OrganizationOverviewType;
    name?: string;
    code?: string;
    legalName?: string;
    unifiedSocialCreditCode?: string;
    status?: OrganizationOverviewStatus;
    source?: OrganizationOverviewSource;
    projectId?: string;
    brandId?: string;
    tenantId?: string;
    headCompanyId?: string;
    sort?: OrganizationOverviewSortKey;
    direction?: OrganizationOverviewSortDirection;
    page?: number;
    pageSize?: number;
    extensionFilters?: ExtensionFilterQuery;
    definitionRevision?: number;
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformOwnerBindingDetail": {
    request: NoBody;
    response: OwnerBindingView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    bindingRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformProviderProfileBindings": {
    request: NoBody;
    response: OwnerBindingPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    providerCode: string;
  };
    query: {
    bindingName?: string;
    nodeQueryText?: string;
    sortKey?: "BINDING_NAME" | "NODE" | "BUSINESS" | "EXTERNAL_OWNER_ID" | "STATUS";
    sortDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getPlatformProviderProfileDetail": {
    request: NoBody;
    response: ProviderProfileView;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    providerCode: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceAccount": {
    request: NoBody;
    response: WorkspaceAccount;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceAccounts": {
    request: NoBody;
    response: WorkspaceAccountPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    userName?: string;
    mobile?: string;
    loginName?: string;
    roleId?: string & { readonly __uuid: "Uuid" };
    status?: WorkspaceAccountStatus;
    serviceNodeType?: ServiceNodeType;
    organizationRef?: string & { readonly __uuid: "Uuid" };
    page?: number;
    pageSize?: number;
    sort?: WorkspacePlatformAccountSortKey;
    direction?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceInvitation": {
    request: NoBody;
    response: PlatformWorkspaceInvitation;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceInvitationCandidates": {
    request: NoBody;
    response: WorkspaceInvitationCandidatePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    targetOrganizationType: ServiceNodeType;
    subjectType: "ORGANIZATION" | "ROLE";
    candidateUsage: "INVITATION_TARGET" | "LIST_FILTER";
    queryText?: string;
    page?: number;
    pageSize?: number;
    selectedOrganizationRef?: string & { readonly __uuid: "Uuid" };
  };
    queryRequired: true;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceInvitations": {
    request: NoBody;
    response: PlatformWorkspaceInvitationPage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    mobile?: string;
    targetOrganizationType?: ServiceNodeType;
    targetOrganizationRef?: string & { readonly __uuid: "Uuid" };
    roleId?: string & { readonly __uuid: "Uuid" };
    status?: WorkspaceInvitationStatus;
    expiresFrom?: number;
    expiresTo?: number;
    sort?: WorkspaceInvitationSortKey;
    direction?: SortDirection;
    page?: number;
    pageSize?: number;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceRole": {
    request: NoBody;
    response: WorkspaceRole;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "getWorkspaceRoles": {
    request: NoBody;
    response: WorkspaceRolePage;
    requestRequired: false;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: {
    name?: string;
    organizationType?: ServiceNodeType;
    status?: WorkspaceRoleStatus;
    page?: number;
    pageSize?: number;
    sort?: WorkspaceRoleSortKey;
    direction?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "initializeCommercialGroup": {
    request: CommercialGroupInitializeRequest;
    response: CommercialGroupRoot;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "listPlatformGroupWorkspaces": {
    request: NoBody;
    response: GroupWorkspacePage;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: {
    name?: string;
    groupWorkspaceKey?: string;
    operationsTitle?: string;
    status?: GroupWorkspaceStatus;
    page?: number;
    pageSize?: number;
    sortKey?: GroupWorkspaceSortKey;
    sortDirection?: SortDirection;
  };
    queryRequired: false;
    headers: Record<string, never>;
    headersRequired: false;
  };
  "platformLogout": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "platformPasswordLogin": {
    request: LoginRequest;
    response: PlatformSessionView;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "reissueWorkspaceInvitation": {
    request: WorkspaceInvitationReissueRequest;
    response: PlatformWorkspaceInvitation;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    invitationId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "releasePlatformStagedAsset": {
    request: NoBody;
    response: NoContent;
    requestRequired: false;
    requiresSession: true;
    path: {
    assetRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "X-Asset-Bind-Grant": string;
  };
    headersRequired: true;
  };
  "replaceExtensionDefinition": {
    request: ExtensionDefinitionUpdateRequest;
    response: ExtensionDefinition;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    entityType: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "requestWorkspaceCredentialReset": {
    request: WorkspaceCredentialResetRequest;
    response: WorkspaceCredentialResetResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "resetPlatformAdminCredential": {
    request: PlatformAdminCredentialResetRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    requiresSession: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "revokePlatformWorkspaceAssignment": {
    request: WorkspaceAssignmentRevokeRequest;
    response: WorkspaceAssignmentRevokeResult;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
    assignmentId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendPlatformLoginOtp": {
    request: PlatformLoginOtpSendRequest;
    response: PlatformOtpDispatchResponse;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "sendPlatformPasswordRecoveryOtp": {
    request: PlatformPasswordRecoveryOtpSendRequest;
    response: PlatformOtpDispatchResponse;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "stagePlatformAsset": {
    request: PlatformAssetStageMultipart;
    response: PlatformAssetStagingResult;
    requestRequired: true;
    requiresSession: true;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "startPlatformPasswordRecovery": {
    request: PlatformPasswordRecoveryStartRequest;
    response: PlatformPasswordRecoveryStartResponse;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformAdminStatus": {
    request: PlatformAdminStatusTransitionRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    requiresSession: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformExternalSystemStatus": {
    request: ExternalSystemStatusRequest;
    response: ExternalSystemView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    externalSystemCode: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformGroupWorkspaceStatus": {
    request: GroupWorkspaceStatusTransitionRequest;
    response: GroupWorkspaceDetail;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionPlatformProviderProfileStatus": {
    request: ProviderProfileStatusRequest;
    response: ProviderProfileView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    providerCode: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionWorkspaceAccountStatus": {
    request: WorkspaceAccountStatusTransitionRequest;
    response: WorkspaceAccount;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    accountId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "transitionWorkspaceRoleStatus": {
    request: WorkspaceRoleStatusTransitionRequest;
    response: WorkspaceRole;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updatePlatformAdminProfile": {
    request: PlatformAdminProfileUpdateRequest;
    response: PlatformAdminDetail;
    requestRequired: true;
    requiresSession: true;
    path: {
    platformAdminId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updatePlatformGroupWorkspaceDisplay": {
    request: GroupWorkspaceDisplayUpdateRequest;
    response: GroupWorkspaceDetail;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updatePlatformOwnerBinding": {
    request: OwnerBindingUpdateRequest;
    response: OwnerBindingView;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    bindingRef: string & { readonly __uuid: "Uuid" };
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "updateWorkspaceRole": {
    request: WorkspaceRoleUpdateRequest;
    response: WorkspaceRole;
    requestRequired: true;
    requiresSession: true;
    path: {
    groupWorkspaceKey: string;
    roleId: string;
  };
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyPlatformLoginOtp": {
    request: PlatformLoginOtpVerifyRequest;
    response: PlatformSessionView;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
  "verifyPlatformPasswordRecoveryOtp": {
    request: PlatformPasswordRecoveryOtpVerifyRequest;
    response: PlatformPasswordRecoveryVerification;
    requestRequired: true;
    requiresSession: false;
    path: Record<string, never>;
    query: Record<string, never>;
    queryRequired: false;
    headers: {
    "Idempotency-Key": string;
  };
    headersRequired: true;
  };
};

type RequestPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["requestRequired"] extends true
  ? {body: FaceOperationContracts[I]["request"]}
  : {body?: never};
type QueryPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["queryRequired"] extends true
  ? {query: FaceOperationContracts[I]["query"]}
  : {query?: FaceOperationContracts[I]["query"]};
type HeaderPart<I extends PlatformAdminOperationId> = FaceOperationContracts[I]["headersRequired"] extends true
  ? {headers: FaceOperationContracts[I]["headers"]}
  : {headers?: never};
export type FaceOperationOptions<I extends PlatformAdminOperationId> = RequestPart<I> & QueryPart<I> & HeaderPart<I>;
export type FaceOperationRequest<I extends PlatformAdminOperationId> = FaceOperationOptions<I> & {
  operationId: I;
  method: (typeof PLATFORM_ADMIN_OPERATIONS)[number]["method"];
  path: (typeof PLATFORM_ADMIN_OPERATIONS)[number]["path"];
  pathParameters: FaceOperationContracts[I]["path"];
  requiresSession: FaceOperationContracts[I]["requiresSession"];
};
export type FaceExecutor = <I extends PlatformAdminOperationId>(request: FaceOperationRequest<I>) => Promise<FaceOperationContracts[I]["response"]>;

export function createPlatformAdminClient(execute: FaceExecutor) {
  return {
    cancelWorkspaceInvitation: (pathParameters: FaceOperationContracts["cancelWorkspaceInvitation"]["path"], options: FaceOperationOptions<"cancelWorkspaceInvitation">) => execute({
      operationId: "cancelWorkspaceInvitation",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/cancel",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    changeCurrentPlatformPassword: (pathParameters: FaceOperationContracts["changeCurrentPlatformPassword"]["path"], options: FaceOperationOptions<"changeCurrentPlatformPassword">) => execute({
      operationId: "changeCurrentPlatformPassword",
      method: "POST",
      path: "/api/platform/auth/password",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    completePlatformPasswordRecovery: (pathParameters: FaceOperationContracts["completePlatformPasswordRecovery"]["path"], options: FaceOperationOptions<"completePlatformPasswordRecovery">) => execute({
      operationId: "completePlatformPasswordRecovery",
      method: "POST",
      path: "/api/platform/auth/password-recovery/complete",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    createPlatformAdmin: (pathParameters: FaceOperationContracts["createPlatformAdmin"]["path"], options: FaceOperationOptions<"createPlatformAdmin">) => execute({
      operationId: "createPlatformAdmin",
      method: "POST",
      path: "/api/platform/admin-users",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createPlatformGroupWorkspace: (pathParameters: FaceOperationContracts["createPlatformGroupWorkspace"]["path"], options: FaceOperationOptions<"createPlatformGroupWorkspace">) => execute({
      operationId: "createPlatformGroupWorkspace",
      method: "POST",
      path: "/api/platform/group-workspaces",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createPlatformOwnerBinding: (pathParameters: FaceOperationContracts["createPlatformOwnerBinding"]["path"], options: FaceOperationOptions<"createPlatformOwnerBinding">) => execute({
      operationId: "createPlatformOwnerBinding",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createWorkspaceInvitation: (pathParameters: FaceOperationContracts["createWorkspaceInvitation"]["path"], options: FaceOperationOptions<"createWorkspaceInvitation">) => execute({
      operationId: "createWorkspaceInvitation",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    createWorkspaceRole: (pathParameters: FaceOperationContracts["createWorkspaceRole"]["path"], options: FaceOperationOptions<"createWorkspaceRole">) => execute({
      operationId: "createWorkspaceRole",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    deletePlatformOwnerBinding: (pathParameters: FaceOperationContracts["deletePlatformOwnerBinding"]["path"], options: FaceOperationOptions<"deletePlatformOwnerBinding">) => execute({
      operationId: "deletePlatformOwnerBinding",
      method: "DELETE",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getCurrentPlatformSession: (pathParameters: FaceOperationContracts["getCurrentPlatformSession"]["path"], options: FaceOperationOptions<"getCurrentPlatformSession">) => execute({
      operationId: "getCurrentPlatformSession",
      method: "GET",
      path: "/api/platform/auth/session",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getExtensionDefinition: (pathParameters: FaceOperationContracts["getExtensionDefinition"]["path"], options: FaceOperationOptions<"getExtensionDefinition">) => execute({
      operationId: "getExtensionDefinition",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getExtensionEntityCatalog: (pathParameters: FaceOperationContracts["getExtensionEntityCatalog"]["path"], options: FaceOperationOptions<"getExtensionEntityCatalog">) => execute({
      operationId: "getExtensionEntityCatalog",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformAdminDetail: (pathParameters: FaceOperationContracts["getPlatformAdminDetail"]["path"], options: FaceOperationOptions<"getPlatformAdminDetail">) => execute({
      operationId: "getPlatformAdminDetail",
      method: "GET",
      path: "/api/platform/admin-users/{platformAdminId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformAdminPage: (pathParameters: FaceOperationContracts["getPlatformAdminPage"]["path"], options: FaceOperationOptions<"getPlatformAdminPage">) => execute({
      operationId: "getPlatformAdminPage",
      method: "GET",
      path: "/api/platform/admin-users",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformContractOverviewDetail: (pathParameters: FaceOperationContracts["getPlatformContractOverviewDetail"]["path"], options: FaceOperationOptions<"getPlatformContractOverviewDetail">) => execute({
      operationId: "getPlatformContractOverviewDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview/{contractId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformContractOverviewPage: (pathParameters: FaceOperationContracts["getPlatformContractOverviewPage"]["path"], options: FaceOperationOptions<"getPlatformContractOverviewPage">) => execute({
      operationId: "getPlatformContractOverviewPage",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/contract-overview",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformEntityAuditHistory: (pathParameters: FaceOperationContracts["getPlatformEntityAuditHistory"]["path"], options: FaceOperationOptions<"getPlatformEntityAuditHistory">) => execute({
      operationId: "getPlatformEntityAuditHistory",
      method: "GET",
      path: "/api/platform/audit-history",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformExternalCapabilityDictionary: (pathParameters: FaceOperationContracts["getPlatformExternalCapabilityDictionary"]["path"], options: FaceOperationOptions<"getPlatformExternalCapabilityDictionary">) => execute({
      operationId: "getPlatformExternalCapabilityDictionary",
      method: "GET",
      path: "/api/platform/external-capability-dictionary",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformExternalCollaborationTree: (pathParameters: FaceOperationContracts["getPlatformExternalCollaborationTree"]["path"], options: FaceOperationOptions<"getPlatformExternalCollaborationTree">) => execute({
      operationId: "getPlatformExternalCollaborationTree",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/external-collaboration",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformExternalSystemDetail: (pathParameters: FaceOperationContracts["getPlatformExternalSystemDetail"]["path"], options: FaceOperationOptions<"getPlatformExternalSystemDetail">) => execute({
      operationId: "getPlatformExternalSystemDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformGroupWorkspaceDetail: (pathParameters: FaceOperationContracts["getPlatformGroupWorkspaceDetail"]["path"], options: FaceOperationOptions<"getPlatformGroupWorkspaceDetail">) => execute({
      operationId: "getPlatformGroupWorkspaceDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformOrganizationCandidates: (pathParameters: FaceOperationContracts["getPlatformOrganizationCandidates"]["path"], options: FaceOperationOptions<"getPlatformOrganizationCandidates">) => execute({
      operationId: "getPlatformOrganizationCandidates",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformOrganizationHierarchyTree: (pathParameters: FaceOperationContracts["getPlatformOrganizationHierarchyTree"]["path"], options: FaceOperationOptions<"getPlatformOrganizationHierarchyTree">) => execute({
      operationId: "getPlatformOrganizationHierarchyTree",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/hierarchy",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformOrganizationOverviewDetail: (pathParameters: FaceOperationContracts["getPlatformOrganizationOverviewDetail"]["path"], options: FaceOperationOptions<"getPlatformOrganizationOverviewDetail">) => execute({
      operationId: "getPlatformOrganizationOverviewDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview/{category}/{itemId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformOrganizationOverviewPage: (pathParameters: FaceOperationContracts["getPlatformOrganizationOverviewPage"]["path"], options: FaceOperationOptions<"getPlatformOrganizationOverviewPage">) => execute({
      operationId: "getPlatformOrganizationOverviewPage",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/organization-overview",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformOwnerBindingDetail: (pathParameters: FaceOperationContracts["getPlatformOwnerBindingDetail"]["path"], options: FaceOperationOptions<"getPlatformOwnerBindingDetail">) => execute({
      operationId: "getPlatformOwnerBindingDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformProviderProfileBindings: (pathParameters: FaceOperationContracts["getPlatformProviderProfileBindings"]["path"], options: FaceOperationOptions<"getPlatformProviderProfileBindings">) => execute({
      operationId: "getPlatformProviderProfileBindings",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/owner-bindings",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getPlatformProviderProfileDetail: (pathParameters: FaceOperationContracts["getPlatformProviderProfileDetail"]["path"], options: FaceOperationOptions<"getPlatformProviderProfileDetail">) => execute({
      operationId: "getPlatformProviderProfileDetail",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceAccount: (pathParameters: FaceOperationContracts["getWorkspaceAccount"]["path"], options: FaceOperationOptions<"getWorkspaceAccount">) => execute({
      operationId: "getWorkspaceAccount",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceAccounts: (pathParameters: FaceOperationContracts["getWorkspaceAccounts"]["path"], options: FaceOperationOptions<"getWorkspaceAccounts">) => execute({
      operationId: "getWorkspaceAccounts",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceInvitation: (pathParameters: FaceOperationContracts["getWorkspaceInvitation"]["path"], options: FaceOperationOptions<"getWorkspaceInvitation">) => execute({
      operationId: "getWorkspaceInvitation",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceInvitationCandidates: (pathParameters: FaceOperationContracts["getWorkspaceInvitationCandidates"]["path"], options: FaceOperationOptions<"getWorkspaceInvitationCandidates">) => execute({
      operationId: "getWorkspaceInvitationCandidates",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitation-candidates",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceInvitations: (pathParameters: FaceOperationContracts["getWorkspaceInvitations"]["path"], options: FaceOperationOptions<"getWorkspaceInvitations">) => execute({
      operationId: "getWorkspaceInvitations",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceRole: (pathParameters: FaceOperationContracts["getWorkspaceRole"]["path"], options: FaceOperationOptions<"getWorkspaceRole">) => execute({
      operationId: "getWorkspaceRole",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    getWorkspaceRoles: (pathParameters: FaceOperationContracts["getWorkspaceRoles"]["path"], options: FaceOperationOptions<"getWorkspaceRoles">) => execute({
      operationId: "getWorkspaceRoles",
      method: "GET",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    initializeCommercialGroup: (pathParameters: FaceOperationContracts["initializeCommercialGroup"]["path"], options: FaceOperationOptions<"initializeCommercialGroup">) => execute({
      operationId: "initializeCommercialGroup",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    listPlatformGroupWorkspaces: (pathParameters: FaceOperationContracts["listPlatformGroupWorkspaces"]["path"], options: FaceOperationOptions<"listPlatformGroupWorkspaces">) => execute({
      operationId: "listPlatformGroupWorkspaces",
      method: "GET",
      path: "/api/platform/group-workspaces",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    platformLogout: (pathParameters: FaceOperationContracts["platformLogout"]["path"], options: FaceOperationOptions<"platformLogout">) => execute({
      operationId: "platformLogout",
      method: "POST",
      path: "/api/platform/auth/logout",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    platformPasswordLogin: (pathParameters: FaceOperationContracts["platformPasswordLogin"]["path"], options: FaceOperationOptions<"platformPasswordLogin">) => execute({
      operationId: "platformPasswordLogin",
      method: "POST",
      path: "/api/platform/auth/password-login",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    reissueWorkspaceInvitation: (pathParameters: FaceOperationContracts["reissueWorkspaceInvitation"]["path"], options: FaceOperationOptions<"reissueWorkspaceInvitation">) => execute({
      operationId: "reissueWorkspaceInvitation",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/invitations/{invitationId}/reissue",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    releasePlatformStagedAsset: (pathParameters: FaceOperationContracts["releasePlatformStagedAsset"]["path"], options: FaceOperationOptions<"releasePlatformStagedAsset">) => execute({
      operationId: "releasePlatformStagedAsset",
      method: "POST",
      path: "/api/platform/assets/staging/{assetRef}/release",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    replaceExtensionDefinition: (pathParameters: FaceOperationContracts["replaceExtensionDefinition"]["path"], options: FaceOperationOptions<"replaceExtensionDefinition">) => execute({
      operationId: "replaceExtensionDefinition",
      method: "PUT",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/extension-definitions/{entityType}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    requestWorkspaceCredentialReset: (pathParameters: FaceOperationContracts["requestWorkspaceCredentialReset"]["path"], options: FaceOperationOptions<"requestWorkspaceCredentialReset">) => execute({
      operationId: "requestWorkspaceCredentialReset",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/credential-reset",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    resetPlatformAdminCredential: (pathParameters: FaceOperationContracts["resetPlatformAdminCredential"]["path"], options: FaceOperationOptions<"resetPlatformAdminCredential">) => execute({
      operationId: "resetPlatformAdminCredential",
      method: "POST",
      path: "/api/platform/admin-users/{platformAdminId}/credential-reset",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    revokePlatformWorkspaceAssignment: (pathParameters: FaceOperationContracts["revokePlatformWorkspaceAssignment"]["path"], options: FaceOperationOptions<"revokePlatformWorkspaceAssignment">) => execute({
      operationId: "revokePlatformWorkspaceAssignment",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/assignments/{assignmentId}/revoke",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    sendPlatformLoginOtp: (pathParameters: FaceOperationContracts["sendPlatformLoginOtp"]["path"], options: FaceOperationOptions<"sendPlatformLoginOtp">) => execute({
      operationId: "sendPlatformLoginOtp",
      method: "POST",
      path: "/api/platform/auth/login-otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    sendPlatformPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["sendPlatformPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"sendPlatformPasswordRecoveryOtp">) => execute({
      operationId: "sendPlatformPasswordRecoveryOtp",
      method: "POST",
      path: "/api/platform/auth/password-recovery/otp/send",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    stagePlatformAsset: (pathParameters: FaceOperationContracts["stagePlatformAsset"]["path"], options: FaceOperationOptions<"stagePlatformAsset">) => execute({
      operationId: "stagePlatformAsset",
      method: "POST",
      path: "/api/platform/assets/staging",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    startPlatformPasswordRecovery: (pathParameters: FaceOperationContracts["startPlatformPasswordRecovery"]["path"], options: FaceOperationOptions<"startPlatformPasswordRecovery">) => execute({
      operationId: "startPlatformPasswordRecovery",
      method: "POST",
      path: "/api/platform/auth/password-recovery/start",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    transitionPlatformAdminStatus: (pathParameters: FaceOperationContracts["transitionPlatformAdminStatus"]["path"], options: FaceOperationOptions<"transitionPlatformAdminStatus">) => execute({
      operationId: "transitionPlatformAdminStatus",
      method: "POST",
      path: "/api/platform/admin-users/{platformAdminId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionPlatformExternalSystemStatus: (pathParameters: FaceOperationContracts["transitionPlatformExternalSystemStatus"]["path"], options: FaceOperationOptions<"transitionPlatformExternalSystemStatus">) => execute({
      operationId: "transitionPlatformExternalSystemStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/external-systems/{externalSystemCode}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionPlatformGroupWorkspaceStatus: (pathParameters: FaceOperationContracts["transitionPlatformGroupWorkspaceStatus"]["path"], options: FaceOperationOptions<"transitionPlatformGroupWorkspaceStatus">) => execute({
      operationId: "transitionPlatformGroupWorkspaceStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionPlatformProviderProfileStatus: (pathParameters: FaceOperationContracts["transitionPlatformProviderProfileStatus"]["path"], options: FaceOperationOptions<"transitionPlatformProviderProfileStatus">) => execute({
      operationId: "transitionPlatformProviderProfileStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/provider-profiles/{providerCode}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionWorkspaceAccountStatus: (pathParameters: FaceOperationContracts["transitionWorkspaceAccountStatus"]["path"], options: FaceOperationOptions<"transitionWorkspaceAccountStatus">) => execute({
      operationId: "transitionWorkspaceAccountStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/accounts/{accountId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    transitionWorkspaceRoleStatus: (pathParameters: FaceOperationContracts["transitionWorkspaceRoleStatus"]["path"], options: FaceOperationOptions<"transitionWorkspaceRoleStatus">) => execute({
      operationId: "transitionWorkspaceRoleStatus",
      method: "POST",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}/status",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updatePlatformAdminProfile: (pathParameters: FaceOperationContracts["updatePlatformAdminProfile"]["path"], options: FaceOperationOptions<"updatePlatformAdminProfile">) => execute({
      operationId: "updatePlatformAdminProfile",
      method: "PATCH",
      path: "/api/platform/admin-users/{platformAdminId}/profile",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updatePlatformGroupWorkspaceDisplay: (pathParameters: FaceOperationContracts["updatePlatformGroupWorkspaceDisplay"]["path"], options: FaceOperationOptions<"updatePlatformGroupWorkspaceDisplay">) => execute({
      operationId: "updatePlatformGroupWorkspaceDisplay",
      method: "PATCH",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updatePlatformOwnerBinding: (pathParameters: FaceOperationContracts["updatePlatformOwnerBinding"]["path"], options: FaceOperationOptions<"updatePlatformOwnerBinding">) => execute({
      operationId: "updatePlatformOwnerBinding",
      method: "PATCH",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/owner-bindings/{bindingRef}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    updateWorkspaceRole: (pathParameters: FaceOperationContracts["updateWorkspaceRole"]["path"], options: FaceOperationOptions<"updateWorkspaceRole">) => execute({
      operationId: "updateWorkspaceRole",
      method: "PATCH",
      path: "/api/platform/group-workspaces/{groupWorkspaceKey}/roles/{roleId}",
      pathParameters,
      requiresSession: true,
      ...options,
    }),
    verifyPlatformLoginOtp: (pathParameters: FaceOperationContracts["verifyPlatformLoginOtp"]["path"], options: FaceOperationOptions<"verifyPlatformLoginOtp">) => execute({
      operationId: "verifyPlatformLoginOtp",
      method: "POST",
      path: "/api/platform/auth/login-otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    }),
    verifyPlatformPasswordRecoveryOtp: (pathParameters: FaceOperationContracts["verifyPlatformPasswordRecoveryOtp"]["path"], options: FaceOperationOptions<"verifyPlatformPasswordRecoveryOtp">) => execute({
      operationId: "verifyPlatformPasswordRecoveryOtp",
      method: "POST",
      path: "/api/platform/auth/password-recovery/otp/verify",
      pathParameters,
      requiresSession: false,
      ...options,
    })
  } as const;
}
