// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeId", required = true) String storeId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phaseName", required = true) String phaseName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contractNo", required = true) String contractNo,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "effectiveFrom", required = true) String effectiveFrom,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "effectiveTo", required = true) String effectiveTo,
    String note,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {}
