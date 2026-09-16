// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStore(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "project", required = true) OrganizationStoreProject project,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "brand", required = true) OrganizationStoreBrand brand,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tenant", required = true) OrganizationStoreTenant tenant,
    OrganizationStoreHeadCompany headCompany,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) OrganizationStoreStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionValues", required = true) tools.jackson.databind.JsonNode extensionValues,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "extensionRuleRevision", required = true) Long extensionRuleRevision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contractDerivedStatus", required = true) String contractDerivedStatus,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operatingRuleSwitches", required = true) OrganizationStoreOperatingRuleValues operatingRuleSwitches
) {}
