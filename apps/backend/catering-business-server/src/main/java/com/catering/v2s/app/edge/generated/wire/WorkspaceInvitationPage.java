// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationPage(
    java.util.List<WorkspaceInvitation> items,
    Long page,
    Long pageSize,
    Long total,
    WorkspaceInvitationPageCriteria criteria
) {}
