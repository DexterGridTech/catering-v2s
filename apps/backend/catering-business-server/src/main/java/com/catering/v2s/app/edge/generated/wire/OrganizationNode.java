// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationNode(
    String id,
    String groupWorkspaceKey,
    String nodeType,
    String parentId,
    String code,
    String name,
    String notes,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    String status,
    java.util.List<OrganizationNodePhasesItem> phases,
    Long revision,
    Long createdAt,
    Long updatedAt
) {}
