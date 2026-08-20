// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelView(
    java.util.UUID channelRef,
    java.util.UUID templateRef,
    String ownerNodeType,
    String ownerNodeTypeDisplayName,
    java.util.UUID ownerNodeRef,
    tools.jackson.databind.JsonNode channelCode,
    String channelName,
    java.util.UUID bindingRef,
    String status,
    String statusDisplayName,
    java.util.List<String> stopReasons,
    java.util.List<String> stopReasonDisplayNames,
    Long version
) {}
