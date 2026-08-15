// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceOperationsInvitationActionRequest(
    java.util.UUID scopeRef,
    Long expectedContextVersion,
    Long expectedVersion,
    String idempotencyKey
) {}
