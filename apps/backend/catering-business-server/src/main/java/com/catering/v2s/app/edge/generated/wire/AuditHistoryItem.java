// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record AuditHistoryItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) java.util.UUID id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "occurredAt", required = true) Long occurredAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actorDisplayName", required = true) String actorDisplayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionSummary", required = true) String actionSummary,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "action", required = true) String action,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "target", required = true) AuditTarget target,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "changes", required = true) java.util.List<AuditChange> changes
) {}
