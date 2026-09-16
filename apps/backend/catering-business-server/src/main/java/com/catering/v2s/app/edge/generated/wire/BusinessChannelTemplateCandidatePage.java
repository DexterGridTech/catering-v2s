// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateCandidatePage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<BusinessChannelTemplateView> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nextCursor", required = true) tools.jackson.databind.JsonNode nextCursor,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "total", required = true) Long total
) {}
