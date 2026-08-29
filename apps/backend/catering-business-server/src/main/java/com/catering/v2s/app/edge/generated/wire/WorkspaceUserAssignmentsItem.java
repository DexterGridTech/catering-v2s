// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserAssignmentsItem(
    String id,
    String accountId,
    String roleId,
    String roleName,
    ServiceNodeType serviceNodeType,
    java.util.List<OrganizationPathNode> organizationPathNodes,
    String status,
    String source,
    Long revision,
    Long createdAt,
    Long updatedAt
) {}
