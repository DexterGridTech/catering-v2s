// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record Problem(
    String type,
    String title,
    Long status,
    String detail,
    String instance,
    String errorCode,
    String correlationId,
    ProblemBrandAuthorizationBlockers brandAuthorizationBlockers
) {}
