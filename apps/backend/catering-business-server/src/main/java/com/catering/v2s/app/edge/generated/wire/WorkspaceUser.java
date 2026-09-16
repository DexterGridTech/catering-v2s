// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUser(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountId", required = true) String accountId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "maskedMobile", required = true) String maskedMobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceAccountStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "credentialStatus", required = true) String credentialStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "activeAssignmentCount", required = true) Long activeAssignmentCount,
    Long lastLoginAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assignments", required = true) java.util.List<WorkspaceUserAssignmentsItem> assignments,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationHistory", required = true) java.util.List<WorkspaceUserInvitationHistoryItem> invitationHistory,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision
) {}
