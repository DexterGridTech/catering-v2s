// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntryCandidatesItem(
    String roleAssignmentRef,
    String roleId,
    String roleName,
    String roleNodeRef,
    ServiceNodeType roleNodeType,
    String roleNodeName,
    String homePageDesignKey,
    java.util.List<String> pageDesignKeys,
    java.util.List<WorkspaceSessionEntryCandidatesItemNavigationItem> navigation
) {}
