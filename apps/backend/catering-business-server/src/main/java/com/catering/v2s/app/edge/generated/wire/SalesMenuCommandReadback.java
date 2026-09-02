// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuCommandReadback(
    String operationKind,
    java.util.UUID salesMenuRef,
    java.util.UUID targetRef,
    Long version,
    String readbackStatus
) {}
