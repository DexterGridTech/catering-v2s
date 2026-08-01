// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminStatusTransitionRequest(
    PlatformAdminStatus targetStatus,
    Long expectedVersion,
    String idempotencyKey
) {}
