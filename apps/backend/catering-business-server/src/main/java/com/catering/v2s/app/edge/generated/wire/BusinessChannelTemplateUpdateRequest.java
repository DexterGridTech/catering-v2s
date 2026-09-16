// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record BusinessChannelTemplateUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateName", required = true) String templateName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeVisibilityScope", required = true) BusinessChannelTemplateStoreVisibilityScope storeVisibilityScope,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "visibleStoreRefs", required = true) java.util.List<java.util.UUID> visibleStoreRefs
) {}
