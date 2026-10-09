// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateVersionReportItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "terminalRef", required = true) java.util.UUID terminalRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "terminalName", required = true) String terminalName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) java.util.UUID storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeName", required = true) String storeName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hasReport", required = true) Boolean hasReport,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actual", required = true) tools.jackson.databind.JsonNode actual,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "recent", required = true) tools.jackson.databind.JsonNode recent
) {}
