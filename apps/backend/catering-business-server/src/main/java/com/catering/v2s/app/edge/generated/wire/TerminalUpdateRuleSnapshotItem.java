// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRuleSnapshotItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ruleRef", required = true) java.util.UUID ruleRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetMode", required = true) String targetMode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRefs", required = true) java.util.List<java.util.UUID> storeRefs,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "applicationId", required = true) String applicationId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAtEpochMillis", required = true) Long createdAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "full", required = true) TerminalUpdateArtifactSummary full,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hot", required = true) tools.jackson.databind.JsonNode hot,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nSeconds", required = true) Long nSeconds,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hotStrategy", required = true) String hotStrategy,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mSeconds", required = true) tools.jackson.databind.JsonNode mSeconds,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "description", required = true) tools.jackson.databind.JsonNode description
) {}
