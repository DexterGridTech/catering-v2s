// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuActivation(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelRef", required = true) java.util.UUID channelRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
