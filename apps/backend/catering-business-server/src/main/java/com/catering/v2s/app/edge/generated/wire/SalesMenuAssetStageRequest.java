// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuAssetStageRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedDraftVersion", required = true) Long expectedDraftVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fileName", required = true) String fileName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mediaType", required = true) String mediaType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contentDigest", required = true) String contentDigest,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "content", required = true) String content
) {}
