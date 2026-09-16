// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateViewStatusDimensionsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) BusinessChannelTemplateViewStatusDimensionsItemType type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ref", required = true) String ref,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) BusinessChannelTemplateViewStatusDimensionsItemStatus status
) {}
