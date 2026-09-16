// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminDetail(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) java.util.UUID id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "userName", required = true) String userName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "loginName", required = true) String loginName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "builtIn", required = true) Boolean builtIn,
    String mobile,
    String maskedMobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) PlatformAdminStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "credentialStatus", required = true) String credentialStatus,
    Long lastLoginAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "version", required = true) Long version,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "auditSummary", required = true) String auditSummary
) {}
