// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreQrConfigurationView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "enabled", required = true) Boolean enabled,
    java.util.UUID channelRef,
    tools.jackson.databind.JsonNode channelName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
