// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntrySelected(
    java.util.UUID roleAssignmentRef,
    String roleId,
    String roleName,
    java.util.UUID roleNodeRef,
    String roleNodeType,
    String roleNodeName,
    String homePageDesignKey,
    java.util.List<String> pageDesignKeys,
    java.util.List<WorkspaceSessionEntrySelectedNavigationItem> navigation,
    Long contextVersion
) {}
