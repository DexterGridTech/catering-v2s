// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record SalesMenuOperationRecord(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationRecordRef", required = true) java.util.UUID operationRecordRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "occurredAt", required = true) Long occurredAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationKind", required = true) String operationKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "salesMenuRef", required = true) java.util.UUID salesMenuRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetRef", required = true) java.util.UUID targetRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetKind", required = true) String targetKind,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetDisplaySnapshot", required = true) String targetDisplaySnapshot,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "result", required = true) String result,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "failureCode", required = true) String failureCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actorDisplayName", required = true) String actorDisplayName
) {}
