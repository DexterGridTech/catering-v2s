// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformAdminCreateRequest(
    String loginName,
    String userName,
    String mobile,
    String password,
    String idempotencyKey
) {}
