// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelName", required = true) String channelName,
    java.util.UUID bindingRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
