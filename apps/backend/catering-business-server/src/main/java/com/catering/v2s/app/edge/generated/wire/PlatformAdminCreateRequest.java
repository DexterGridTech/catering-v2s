// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "userName", required = true) String userName,
    String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "password", required = true) String password,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "idempotencyKey", required = true) String idempotencyKey
) {}
