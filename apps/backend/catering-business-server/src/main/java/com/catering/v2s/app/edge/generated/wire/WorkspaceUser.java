// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUser(
    String accountId,
    String displayName,
    String maskedMobile,
    String loginName,
    WorkspaceAccountStatus status,
    String credentialStatus,
    Long activeAssignmentCount,
    Long lastLoginAt,
    Long createdAt,
    java.util.List<WorkspaceUserAssignmentsItem> assignments,
    java.util.List<WorkspaceUserInvitationHistoryItem> invitationHistory,
    Long revision
) {}
