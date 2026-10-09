// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateReportReceipt(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reportId", required = true) java.util.UUID reportId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "taskId", required = true) java.util.UUID taskId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "acceptedSequence", required = true) Long acceptedSequence,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "outcome", required = true) String outcome
) {}
