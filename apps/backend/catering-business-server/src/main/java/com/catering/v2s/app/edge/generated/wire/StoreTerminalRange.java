// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreTerminalRange(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "key", required = true) String key,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "all", required = true) Boolean all,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "refs", required = true) java.util.List<java.util.UUID> refs
) {}
