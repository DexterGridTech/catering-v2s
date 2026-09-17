// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreQrChannelCandidate(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelRef", required = true) java.util.UUID channelRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateRef", required = true) java.util.UUID templateRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelCode", required = true) tools.jackson.databind.JsonNode channelCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "channelName", required = true) String channelName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "templateName", required = true) String templateName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "bindingStatus", required = true) String bindingStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "urlRule", required = true) tools.jackson.databind.JsonNode urlRule
) {}
