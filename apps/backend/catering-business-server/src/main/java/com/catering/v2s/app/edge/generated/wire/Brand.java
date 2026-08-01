// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record Brand(
    String id,
    String groupWorkspaceKey,
    String code,
    String name,
    String alias,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long extensionRuleRevision,
    BusinessEntityStatus status,
    Long revision,
    Long createdAt,
    Long updatedAt
) {}
