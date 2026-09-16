// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitation(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "maskedMobile", required = true) String maskedMobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationType", required = true) String targetOrganizationType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleNames", required = true) java.util.List<String> roleNames,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) WorkspaceInvitationStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "generation", required = true) Long generation,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAt", required = true) Long expiresAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    Long consentedAt,
    Long completedAt,
    Long cancelledAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationPathNodes", required = true) java.util.List<OrganizationPathNode> targetOrganizationPathNodes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "invitationRouteFacts", required = true) InvitationRouteFacts invitationRouteFacts
) {}
