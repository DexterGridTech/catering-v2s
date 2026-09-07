// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuOperationRecord(
    java.util.UUID operationRecordRef,
    Long occurredAt,
    String operationKind,
    java.util.UUID salesMenuRef,
    java.util.UUID targetRef,
    String targetKind,
    String targetDisplaySnapshot,
    String result,
    String failureCode,
    String actorDisplayName
) {}
