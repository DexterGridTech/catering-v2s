// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record TenantCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "legalName", required = true) String legalName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "unifiedSocialCreditCode", required = true) String unifiedSocialCreditCode,
    String remark,
    tools.jackson.databind.JsonNode extensionValues,
    Long expectedExtensionRuleRevision
) {}
