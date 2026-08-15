// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationHierarchyTreeNode(
    java.util.UUID id,
    String type,
    String code,
    String name,
    OrganizationOverviewStatus status,
    String notes,
    Long updatedAt,
    java.util.List<OrganizationHierarchyTreeNode> children,
    java.util.List<String> phases
) {}
