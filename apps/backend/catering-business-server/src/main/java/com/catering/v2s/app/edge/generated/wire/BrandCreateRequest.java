// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BrandCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    String alias,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision
) {}
