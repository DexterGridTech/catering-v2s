// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformLoginOtpVerifyRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mobile", required = true) String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code
) {}
