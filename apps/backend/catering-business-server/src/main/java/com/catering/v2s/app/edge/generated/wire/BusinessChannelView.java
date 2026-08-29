// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelView(
    java.util.UUID channelRef,
    java.util.UUID templateRef,
    BusinessChannelViewOwnerNodeType ownerNodeType,
    java.util.UUID ownerNodeRef,
    tools.jackson.databind.JsonNode channelCode,
    String channelName,
    java.util.UUID bindingRef,
    BusinessChannelViewStatus status,
    BusinessChannelViewBindingStatus bindingStatus,
    BusinessChannelViewSelfStatus selfStatus,
    java.util.List<BusinessChannelViewStatusDimensionsItem> statusDimensions,
    java.util.List<BusinessChannelViewBlockersItem> blockers,
    Long version
) {}
