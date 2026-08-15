// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record PlatformSessionView(
    java.util.UUID sessionId,
    String displayName,
    java.util.List<String> capabilities,
    Boolean platformAdminAccessible,
    Long sessionVersion
) {}
