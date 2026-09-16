// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicAssetReference(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "publicUrl", required = true) String publicUrl,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contentType", required = true) String contentType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sha256", required = true) String sha256
) {}
