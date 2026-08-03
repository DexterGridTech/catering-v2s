// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformWorkspaceInvitationPage(
    java.util.List<PlatformWorkspaceInvitation> items,
    Long page,
    Long pageSize,
    Long total,
    PlatformWorkspaceInvitationPageCriteria criteria
) {}
