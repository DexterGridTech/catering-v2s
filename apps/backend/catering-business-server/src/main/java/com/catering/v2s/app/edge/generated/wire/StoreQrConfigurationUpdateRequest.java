// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreQrConfigurationUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "enabled", required = true) Boolean enabled,
    java.util.UUID channelRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion
) {}
