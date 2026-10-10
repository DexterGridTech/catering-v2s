// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateReportHistoryPageItemsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reportId", required = true) java.util.UUID reportId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "taskId", required = true) java.util.UUID taskId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "reportSequence", required = true) Long reportSequence,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actual", required = true) TerminalUpdateReportActual actual,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "recent", required = true) TerminalUpdateReportRecent recent,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "references", required = true) TerminalUpdateReportHistoryPageItemsItemReferences references,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "receivedAtEpochMillis", required = true) Long receivedAtEpochMillis
) {}
