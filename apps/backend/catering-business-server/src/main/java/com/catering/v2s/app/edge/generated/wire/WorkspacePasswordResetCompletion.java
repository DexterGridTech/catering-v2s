// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspacePasswordResetCompletion(
    String status,
    String loginName,
    String message,
    String loginPath,
    Boolean sessionsRevoked
) {}
