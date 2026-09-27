// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalBinding(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreTerminalBindingStatus status,
    Long activatedAt,
    Long generation
) {}
