// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateViewBlockersItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) BusinessChannelTemplateViewBlockersItemType type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ref", required = true) String ref,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) BusinessChannelTemplateViewBlockersItemStatus status
) {}
