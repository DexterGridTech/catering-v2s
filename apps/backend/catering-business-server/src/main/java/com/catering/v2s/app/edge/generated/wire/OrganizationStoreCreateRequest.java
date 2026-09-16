// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationStoreCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "brandId", required = true) String brandId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "tenantId", required = true) String tenantId,
    String headCompanyId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    String notes,
    tools.jackson.databind.JsonNode extensionValues,
    OrganizationStoreOperatingRuleValues operatingRuleSwitches
) {}
