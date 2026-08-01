// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BrandUpdateRequest(
    String code,
    String name,
    String alias,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedVersion,
    Long expectedContextVersion
) {}
