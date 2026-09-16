// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminProfileUpdateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "userName", required = true) String userName,
    String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "expectedVersion", required = true) Long expectedVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
