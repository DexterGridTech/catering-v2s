// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceAccount(
    String id,
    String groupWorkspaceKey,
    String displayName,
    String mobile,
    String loginName,
    WorkspaceAccountStatus status,
    String credentialStatus,
    Long activeAssignmentCount,
    Long lastLoginAt,
    Long createdAt,
    Long updatedAt,
    Long revision,
    java.util.List<WorkspaceAccountAssignmentsItem> assignments,
    java.util.List<WorkspaceAccountInvitationHistoryItem> invitationHistory,
    java.util.List<WorkspaceAccountAuthenticationHistoryItem> authenticationHistory
) {}
