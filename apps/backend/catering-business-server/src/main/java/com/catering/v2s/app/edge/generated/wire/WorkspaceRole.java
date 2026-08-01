// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRole(
    String id,
    String groupWorkspaceKey,
    String name,
    String description,
    ServiceNodeType serviceNodeType,
    java.util.List<String> capabilityKeys,
    java.util.List<String> pageAccessKeys,
    WorkspaceRoleStatus status,
    Long revision,
    Long createdAt,
    Long updatedAt
) {}
