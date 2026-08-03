// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserPage(
    java.util.List<WorkspaceUser> items,
    Long page,
    Long pageSize,
    Long total,
    ServiceNodeType targetOrganizationType,
    String scopeRef,
    String scopeName,
    Long contextVersion,
    WorkspaceUserPageCriteria criteria
) {}
