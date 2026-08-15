// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record AuditHistoryItem(
    java.util.UUID id,
    Long occurredAt,
    String actorDisplayName,
    String actionSummary,
    String action,
    AuditTarget target,
    java.util.List<AuditChange> changes
) {}
