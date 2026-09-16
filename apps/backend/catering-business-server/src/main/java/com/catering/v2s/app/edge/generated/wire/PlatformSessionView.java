// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformSessionView(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionId", required = true) java.util.UUID sessionId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "capabilities", required = true) java.util.List<String> capabilities,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "platformAdminAccessible", required = true) Boolean platformAdminAccessible,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "sessionVersion", required = true) Long sessionVersion
) {}
