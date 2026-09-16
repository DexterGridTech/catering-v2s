// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OperationsPasswordRecoveryStartRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mobile", required = true) String mobile
) {}
