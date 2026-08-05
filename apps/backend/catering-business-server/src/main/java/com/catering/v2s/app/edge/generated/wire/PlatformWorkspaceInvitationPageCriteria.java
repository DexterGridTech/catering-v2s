// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformWorkspaceInvitationPageCriteria(
    String mobile,
    ServiceNodeType targetOrganizationType,
    String targetOrganizationRef,
    String roleId,
    WorkspaceInvitationStatus status,
    Long expiresFrom,
    Long expiresTo,
    WorkspaceInvitationSortKey sort,
    SortDirection direction
) {}
