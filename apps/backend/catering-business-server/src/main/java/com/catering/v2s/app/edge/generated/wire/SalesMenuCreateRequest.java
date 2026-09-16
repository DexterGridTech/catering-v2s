// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelRef", required = true) java.util.UUID channelRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name
) {}
