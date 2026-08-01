// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceOperationsInvitationCreateRequest(
    String scopeRef,
    String mobile,
    java.util.List<String> roleIds,
    Long expectedContextVersion,
    String idempotencyKey
) {}
