// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAssetStageMultipart(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "usage", required = true) String usage,
    String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "file", required = true) String file
) {}
