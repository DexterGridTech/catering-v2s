// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelCreateRequest(
    java.util.UUID templateRef,
    String ownerNodeType,
    java.util.UUID ownerNodeRef,
    String channelCode,
    String channelName,
    java.util.UUID bindingRef
) {}
