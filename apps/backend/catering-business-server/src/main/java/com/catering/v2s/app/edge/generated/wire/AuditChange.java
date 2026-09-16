// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record AuditChange(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fieldKey", required = true) String fieldKey,
    String fieldLabelSnapshot,
    AuditValueState beforeState,
    String beforeValue,
    AuditValueState afterState,
    String afterValue
) {}
