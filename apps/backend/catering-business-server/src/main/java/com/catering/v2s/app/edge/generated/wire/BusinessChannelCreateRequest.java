// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateRef", required = true) java.util.UUID templateRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ownerNodeType", required = true) String ownerNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ownerNodeRef", required = true) java.util.UUID ownerNodeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelCode", required = true) String channelCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelName", required = true) String channelName,
    java.util.UUID bindingRef
) {}
