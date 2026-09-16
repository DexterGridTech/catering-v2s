// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContract(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "project", required = true) StoreContractProject project,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "store", required = true) StoreContractStore store,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tenant", required = true) StoreContractTenant tenant,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phaseName", required = true) String phaseName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contractNo", required = true) String contractNo,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "effectiveFrom", required = true) String effectiveFrom,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "effectiveTo", required = true) String effectiveTo,
    String note,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionValues", required = true) tools.jackson.databind.JsonNode extensionValues,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionRuleRevision", required = true) Long extensionRuleRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreContractStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "source", required = true) String source,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreContractItem> items,
    String phaseNameSnapshot
) {}
