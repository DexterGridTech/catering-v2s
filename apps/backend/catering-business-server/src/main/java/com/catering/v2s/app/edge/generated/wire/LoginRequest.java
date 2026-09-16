// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record LoginRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountName", required = true) String accountName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "password", required = true) String password
) {}
