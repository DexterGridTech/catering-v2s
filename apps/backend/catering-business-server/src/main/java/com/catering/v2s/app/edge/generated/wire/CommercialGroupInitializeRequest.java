// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record CommercialGroupInitializeRequest(
    String groupCode,
    String groupName,
    tools.jackson.databind.JsonNode extensionValues,
    String idempotencyKey
) {}
