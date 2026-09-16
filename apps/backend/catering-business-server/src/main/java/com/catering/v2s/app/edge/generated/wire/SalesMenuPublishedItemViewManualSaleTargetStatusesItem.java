// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuPublishedItemViewManualSaleTargetStatusesItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetKind", required = true) String targetKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetRef", required = true) java.util.UUID targetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "resolvedTargetDisplayName", required = true) String resolvedTargetDisplayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "state", required = true) String state,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reason", required = true) String reason,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "changedAt", required = true) Long changedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "changedByDisplayName", required = true) String changedByDisplayName
) {}
