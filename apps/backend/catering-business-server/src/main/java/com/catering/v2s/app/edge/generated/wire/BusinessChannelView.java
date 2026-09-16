// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelRef", required = true) java.util.UUID channelRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateRef", required = true) java.util.UUID templateRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ownerNodeType", required = true) BusinessChannelViewOwnerNodeType ownerNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ownerNodeRef", required = true) java.util.UUID ownerNodeRef,
    tools.jackson.databind.JsonNode channelCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelName", required = true) String channelName,
    java.util.UUID bindingRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) BusinessChannelViewStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingStatus", required = true) BusinessChannelViewBindingStatus bindingStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "selfStatus", required = true) BusinessChannelViewSelfStatus selfStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "statusDimensions", required = true) java.util.List<BusinessChannelViewStatusDimensionsItem> statusDimensions,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "blockers", required = true) java.util.List<BusinessChannelViewBlockersItem> blockers,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version
) {}
