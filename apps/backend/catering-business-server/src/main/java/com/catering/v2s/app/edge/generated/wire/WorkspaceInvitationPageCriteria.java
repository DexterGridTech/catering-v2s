// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationPageCriteria(
    String mobile,
    String organizationQuery,
    String roleQuery,
    WorkspaceInvitationStatus status,
    Long expiresFrom,
    Long expiresTo,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sort", required = true) WorkspaceInvitationSortKey sort,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "direction", required = true) SortDirection direction
) {}
