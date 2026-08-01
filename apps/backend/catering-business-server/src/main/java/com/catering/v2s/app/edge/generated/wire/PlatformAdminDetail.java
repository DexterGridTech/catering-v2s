// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminDetail(
    String id,
    String userName,
    String loginName,
    Boolean builtIn,
    String mobile,
    String maskedMobile,
    PlatformAdminStatus status,
    String credentialStatus,
    Long lastLoginAt,
    Long createdAt,
    Long updatedAt,
    Long version,
    String auditSummary
) {}
