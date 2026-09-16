// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformOtpDispatchResponse(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expiresAt", required = true) Long expiresAt,
    String debugVerificationCode
) {}
