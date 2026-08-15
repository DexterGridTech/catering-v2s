// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationNodeUpdateRequest(
    String code,
    String name,
    String parentId,
    java.util.List<OrganizationNodeUpdateRequestPhasesItem> phases,
    String notes,
    Long expectedVersion,
    tools.jackson.databind.JsonNode extensionValues
) {}
