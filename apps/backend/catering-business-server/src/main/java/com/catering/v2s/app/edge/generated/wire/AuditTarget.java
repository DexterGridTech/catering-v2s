// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record AuditTarget(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "entityType", required = true) String entityType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "entityId", required = true) String entityId
) {}
