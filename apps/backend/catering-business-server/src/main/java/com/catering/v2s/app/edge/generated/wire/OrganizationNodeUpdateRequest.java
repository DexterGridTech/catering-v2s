// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationNodeUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "parentId", required = true) String parentId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phases", required = true) java.util.List<OrganizationNodeUpdateRequestPhasesItem> phases,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
    tools.jackson.databind.JsonNode extensionValues
) {}
