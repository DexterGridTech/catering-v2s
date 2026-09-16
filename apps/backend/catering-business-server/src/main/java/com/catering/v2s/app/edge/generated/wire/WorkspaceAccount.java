// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceAccount(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mobile", required = true) String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceAccountStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "credentialStatus", required = true) String credentialStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "activeAssignmentCount", required = true) Long activeAssignmentCount,
    Long lastLoginAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "assignments", required = true) java.util.List<WorkspaceAccountAssignmentsItem> assignments,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationHistory", required = true) java.util.List<WorkspaceAccountInvitationHistoryItem> invitationHistory,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "authenticationHistory", required = true) java.util.List<WorkspaceAccountAuthenticationHistoryItem> authenticationHistory
) {}
