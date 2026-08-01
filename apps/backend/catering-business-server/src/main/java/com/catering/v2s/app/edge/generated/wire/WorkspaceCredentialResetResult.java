// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceCredentialResetResult(
    String accountId,
    String loginName,
    WorkspaceAccountStatus status,
    String credentialStatus,
    Long generation,
    Long expiresAt,
    String deliveryStatus,
    Long revision
) {}
