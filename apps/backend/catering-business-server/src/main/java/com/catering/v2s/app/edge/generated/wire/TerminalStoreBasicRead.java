// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TerminalStoreBasicRead(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "store", required = true) OrganizationStore store,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operatingRules", required = true) OrganizationStoreOperatingRuleValues operatingRules,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeUpdatedAtEpochMillis", required = true) Long storeUpdatedAtEpochMillis,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operatingRulesUpdatedAtEpochMillis", required = true) Long operatingRulesUpdatedAtEpochMillis
) {}
