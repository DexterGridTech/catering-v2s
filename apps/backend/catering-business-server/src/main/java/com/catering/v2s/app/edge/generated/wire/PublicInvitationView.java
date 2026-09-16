// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationId", required = true) String invitationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationType", required = true) String targetOrganizationType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleNames", required = true) java.util.List<String> roleNames,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "maskedMobile", required = true) String maskedMobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceInvitationStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAt", required = true) Long expiresAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "workspaceName", required = true) String workspaceName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextStep", required = true) String nextStep,
    String logoUrl,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationPathNodes", required = true) java.util.List<OrganizationPathNode> targetOrganizationPathNodes
) {}
