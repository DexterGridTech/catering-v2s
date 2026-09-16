// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuCommandReadback(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationKind", required = true) String operationKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesMenuRef", required = true) java.util.UUID salesMenuRef,
    java.util.UUID targetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "readbackStatus", required = true) String readbackStatus
) {}
