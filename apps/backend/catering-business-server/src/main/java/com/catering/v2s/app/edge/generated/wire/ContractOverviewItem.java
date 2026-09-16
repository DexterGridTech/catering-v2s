// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record ContractOverviewItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contractRef", required = true) ContractOverviewItemContractRef contractRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeRef", required = true) ContractOverviewItemStoreRef storeRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phaseName", required = true) String phaseName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tenantRef", required = true) ContractOverviewItemTenantRef tenantRef,
    String effectiveFrom,
    String effectiveTo,
    String note,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) StoreContractStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "source", required = true) String source,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "storeResolutionStatus", required = true) String storeResolutionStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tenantResolutionStatus", required = true) String tenantResolutionStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "projectRef", required = true) ContractOverviewItemProjectRef projectRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<StoreContractItem> items,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionValues", required = true) tools.jackson.databind.JsonNode extensionValues,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionRuleRevision", required = true) Long extensionRuleRevision
) {}
