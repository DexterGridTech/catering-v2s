// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationCandidatePage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "organizations", required = true) java.util.List<WorkspaceInvitationCandidatePageOrganizationsItem> organizations,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roles", required = true) java.util.List<WorkspaceRole> roles,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) WorkspaceInvitationCandidatePageMetadata metadata
) {}
