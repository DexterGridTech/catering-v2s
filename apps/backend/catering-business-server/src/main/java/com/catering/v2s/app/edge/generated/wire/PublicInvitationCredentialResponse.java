// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PublicInvitationCredentialResponse(
    String verificationGrant,
    AccountPresenceStatus accountExists,
    Boolean userNameReady,
    Boolean loginNameReady,
    Boolean passwordReady,
    String nextStep
) {}
