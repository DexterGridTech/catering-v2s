// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalUpdateRuleDetail(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "ruleRef", required = true) java.util.UUID ruleRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) java.util.UUID projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetMode", required = true) String targetMode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "fullArtifactRef", required = true) java.util.UUID fullArtifactRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hotArtifactRef", required = true) java.util.UUID hotArtifactRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "nSeconds", required = true) Long nSeconds,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "hotStrategy", required = true) String hotStrategy,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mSeconds", required = true) tools.jackson.databind.JsonNode mSeconds,
    tools.jackson.databind.JsonNode description,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAtEpochMillis", required = true) Long createdAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRefs", required = true) java.util.List<java.util.UUID> storeRefs
) {}
